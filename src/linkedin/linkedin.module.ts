import { Module } from '@nestjs/common';
import { LinkedInService } from './linkedin.service';
import { LinkedInController } from './linkedin.controller';

@Module({
  controllers: [LinkedInController],
  providers: [LinkedInService],
})
export class LinkedinModule {}
