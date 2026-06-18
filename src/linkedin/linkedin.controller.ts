import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { LinkedInService } from './linkedin.service';
import { DiscoverJobsSyncDto, DiscoverJobsDto } from './dtos/DiscoveryJob.dto';
import { LinkedInJob } from './interface/linkedin.interface';

@Controller('linkedin')
export class LinkedInController {
  constructor(private readonly linkedInService: LinkedInService) {}

  /**
   * POST /linkedin/jobs/search
   * Synchronous — returns results immediately.
   *
   * Body:
   * {
   *   "queries": [
   *     { "location": "Berlin", "keyword": "product manager", "country": "DE", "remote": "Hybrid" }
   *   ]
   * }
   */
  @Post('jobs/search')
  @HttpCode(HttpStatus.OK)
  async searchJobs(
    @Body() body: DiscoverJobsSyncDto,
  ): Promise<{ count: number; jobs: LinkedInJob[] }> {
    const jobs = await this.linkedInService.discoverJobsByKeyword(body.queries);
    return { count: jobs.length, jobs };
  }

  /**
   * POST /linkedin/jobs/search/async
   * Asynchronous — returns a snapshot_id for large queries.
   * Optionally provide notifyUrl to receive a webhook when ready.
   *
   * Body:
   * {
   *   "queries": [...],
   *   "notifyUrl": "https://yourapp.com/webhooks/brightdata"   // optional
   * }
   */
  @Post('jobs/search/async')
  @HttpCode(HttpStatus.ACCEPTED)
  async searchJobsAsync(
    @Body() body: DiscoverJobsDto,
  ): Promise<{ snapshot_id: string; message: string }> {
    const result = await this.linkedInService.discoverJobsByKeywordAsync(
      body.queries,
      body.notifyUrl,
    );
    return {
      snapshot_id: result.snapshot_id,
      message: `Snapshot queued. Poll GET /linkedin/jobs/snapshot/${result.snapshot_id} to retrieve results.`,
    };
  }

  /**
   * GET /linkedin/jobs/snapshot/:snapshotId
   * Poll for results of a previously triggered async job.
   * Query param ?wait=true blocks until ready (max 5 min).
   */
  @Get('jobs/snapshot/:snapshotId')
  async getSnapshot(
    @Param('snapshotId') snapshotId: string,
    @Query('wait') wait?: string,
  ): Promise<
    | { count: number; jobs: LinkedInJob[] }
    | { snapshot_id: string; status: string }
  > {
    if (!snapshotId?.trim()) {
      throw new BadRequestException('snapshotId is required');
    }

    if (wait === 'true') {
      // Block until ready (up to 5 minutes)
      const jobs = await this.linkedInService.pollSnapshot(snapshotId.trim());
      return { count: jobs.length, jobs };
    }

    // Single-check non-blocking version — poll once and return raw status
    const jobs = await this.linkedInService
      .pollSnapshot(snapshotId.trim(), {
        intervalMs: 0,
        timeoutMs: 1,
      })
      .catch(() => null);

    if (jobs) return { count: jobs.length, jobs };

    return {
      snapshot_id: snapshotId,
      status: 'pending — retry later or use ?wait=true',
    };
  }
}
