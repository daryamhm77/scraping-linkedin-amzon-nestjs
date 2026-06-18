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
  private readonly baseUrl = 'https://api.brightdata.com/datasets/v3/scrape';
  private readonly datasetId = 'gd_lpfll7v5hcqtkxl6l';

  constructor(private readonly configService: ConfigService) {}

  /**
   * Discover LinkedIn job listings by keyword — synchronous (real-time) mode.
   * Returns results directly. Best for quick, small queries.
   */
  async discoverJobsByKeyword(
    queries: LinkedInJobQuery[],
  ): Promise<LinkedInJob[]> {
    const token = this.configService.getOrThrow<string>('BRIGHT_DATA_TOKEN');

    const url = new URL(this.baseUrl);
    url.searchParams.set('dataset_id', this.datasetId);
    url.searchParams.set('notify', 'false');
    url.searchParams.set('include_errors', 'false');

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: queries }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Bright Data API error [${response.status}]: ${error}`);
    }

    const data = await response.json();

    // Synchronous mode returns the results directly as an array
    if (Array.isArray(data)) {
      return data as LinkedInJob[];
    }

    // Some responses may wrap results
    if (data?.data) {
      return data.data as LinkedInJob[];
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
    const token = this.configService.getOrThrow<string>('BRIGHT_DATA_TOKEN');

    const url = new URL(this.baseUrl);
    url.searchParams.set('dataset_id', this.datasetId);
    url.searchParams.set('notify', notifyUrl ? 'true' : 'false');
    url.searchParams.set('include_errors', 'false');
    if (notifyUrl) url.searchParams.set('endpoint', notifyUrl);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
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

  /**
   * Poll a snapshot until it is ready, then return the results.
   * Useful when you kicked off an async request and want to await results.
   */
  async pollSnapshot(
    snapshotId: string,
    opts: { intervalMs?: number; timeoutMs?: number } = {},
  ): Promise<LinkedInJob[]> {
    const { intervalMs = 5_000, timeoutMs = 5 * 60 * 1_000 } = opts;
    const token = this.configService.getOrThrow<string>('BRIGHT_DATA_TOKEN');
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const response = await fetch(
        `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (!response.ok) {
        throw new Error(`Snapshot poll error [${response.status}]`);
      }

      const payload: BrightDataResponse = await response.json();

      if (payload.status === 'ready' && payload.data) {
        return payload.data;
      }

      if (payload.status === 'failed') {
        throw new Error(`Snapshot ${snapshotId} failed on Bright Data side`);
      }

      this.logger.debug(
        `Snapshot ${snapshotId} status: ${payload.status} — waiting…`,
      );
      await new Promise((r) => setTimeout(r, intervalMs));
    }

    throw new Error(`Timed out waiting for snapshot ${snapshotId}`);
  }
}
