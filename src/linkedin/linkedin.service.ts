import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LinkedInJobQuery,
  LinkedInJob,
  BrightDataResponse,
} from './interface/linkedin.interface';

@Injectable()
export class LinkedInService {
  private readonly logger = new Logger(LinkedInService.name);
  private readonly datasetId = 'gd_lpfll7v5hcqtkxl6l';

  constructor(private readonly configService: ConfigService) {}

  private getToken(): string {
    return this.configService.getOrThrow<string>('BRIGHT_DATA_TOKEN');
  }

  private buildDiscoverUrl(
    endpoint: 'scrape' | 'trigger',
    extraParams: Record<string, string> = {},
  ): URL {
    const url = new URL(
      `https://api.brightdata.com/datasets/v3/${endpoint}`,
    );
    url.searchParams.set('dataset_id', this.datasetId);
    url.searchParams.set('format', 'json');
    url.searchParams.set('type', 'discover_new');
    url.searchParams.set('discover_by', 'keyword');

    for (const [key, value] of Object.entries(extraParams)) {
      url.searchParams.set(key, value);
    }

    return url;
  }

  private async postDiscoverRequest(
    url: URL,
    queries: LinkedInJobQuery[],
  ): Promise<unknown> {
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.getToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: queries }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Bright Data API error [${response.status}]: ${error}`);
    }

    return response.json();
  }

  private async fetchWithRetry(
    url: string,
    init?: RequestInit,
    retries = 3,
  ): Promise<Response> {
    let lastError: unknown;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        return await fetch(url, init);
      } catch (error) {
        lastError = error;
        if (attempt < retries - 1) {
          await new Promise((r) => setTimeout(r, 2_000 * (attempt + 1)));
        }
      }
    }

    throw lastError;
  }

  private extractJobs(data: unknown): LinkedInJob[] | null {
    if (Array.isArray(data)) {
      return data as LinkedInJob[];
    }

    const payload = data as BrightDataResponse & { data?: LinkedInJob[] };
    if (Array.isArray(payload?.data)) {
      return payload.data;
    }

    return null;
  }

  private extractSnapshotId(data: unknown): string | null {
    const payload = data as { snapshot_id?: string };
    return payload?.snapshot_id ?? null;
  }

  /**
   * Discover LinkedIn job listings by keyword — synchronous (real-time) mode.
   * Returns results directly when ready, otherwise polls the snapshot.
   */
  async discoverJobsByKeyword(
    queries: LinkedInJobQuery[],
  ): Promise<LinkedInJob[]> {
    const url = this.buildDiscoverUrl('scrape', {
      notify: 'false',
      include_errors: 'false',
    });

    const data = await this.postDiscoverRequest(url, queries);
    const jobs = this.extractJobs(data);
    if (jobs) {
      return jobs;
    }

    const snapshotId = this.extractSnapshotId(data);
    if (snapshotId) {
      this.logger.log(`Discover request queued as snapshot ${snapshotId}`);
      return this.pollSnapshot(snapshotId);
    }

    this.logger.warn('Unexpected response shape from Bright Data', data);
    return [];
  }

  /**
   * Discover LinkedIn job listings asynchronously.
   * Returns a snapshot_id you can poll later for large queries.
   */
  async discoverJobsByKeywordAsync(
    queries: LinkedInJobQuery[],
    notifyUrl?: string,
  ): Promise<{ snapshot_id: string }> {
    const params: Record<string, string> = {
      include_errors: 'false',
      notify: notifyUrl ? 'true' : 'false',
      limit_per_input: '5',
    };
    if (notifyUrl) {
      params.endpoint = notifyUrl;
    }

    const url = this.buildDiscoverUrl('trigger', params);
    const data = await this.postDiscoverRequest(url, queries);

    const snapshotId = this.extractSnapshotId(data);
    if (!snapshotId) {
      throw new Error(
        `Bright Data trigger did not return snapshot_id: ${JSON.stringify(data)}`,
      );
    }

    return { snapshot_id: snapshotId };
  }

  /**
   * Poll a snapshot until it is ready, then return the results.
   */
  async pollSnapshot(
    snapshotId: string,
    opts: { intervalMs?: number; timeoutMs?: number } = {},
  ): Promise<LinkedInJob[]> {
    const { intervalMs = 5_000, timeoutMs = 15 * 60 * 1_000 } = opts;
    const deadline = Date.now() + timeoutMs;
    const authHeader = { Authorization: `Bearer ${this.getToken()}` };

    while (Date.now() < deadline) {
      const progressResponse = await this.fetchWithRetry(
        `https://api.brightdata.com/datasets/v3/progress/${snapshotId}`,
        { headers: authHeader },
      );

      if (!progressResponse.ok) {
        throw new Error(`Snapshot progress error [${progressResponse.status}]`);
      }

      const progress = (await progressResponse.json()) as {
        status?: string;
      };

      if (progress.status === 'ready') {
        const dataResponse = await this.fetchWithRetry(
          `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}?format=json`,
          { headers: authHeader },
        );

        if (!dataResponse.ok) {
          throw new Error(`Snapshot download error [${dataResponse.status}]`);
        }

        const data = await dataResponse.json();
        const jobs = this.extractJobs(data);
        if (jobs?.length) {
          return jobs;
        }

        throw new Error(`Snapshot ${snapshotId} is ready but returned no jobs`);
      }

      if (progress.status === 'failed') {
        throw new Error(`Snapshot ${snapshotId} failed on Bright Data side`);
      }

      if (intervalMs <= 0) {
        break;
      }

      this.logger.debug(
        `Snapshot ${snapshotId} status: ${progress.status ?? 'unknown'} — waiting…`,
      );
      await new Promise((r) => setTimeout(r, intervalMs));
    }

    throw new Error(`Timed out waiting for snapshot ${snapshotId}`);
  }
}
