import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import {
  TimeRange,
  JobType,
  ExperienceLevel,
  RemoteFilter,
} from '../types/linkedin';

export class LinkedInJobQueryDto {
  @IsString()
  location: string;

  @IsString()
  keyword: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsEnum(TimeRange)
  time_range?: TimeRange;

  @IsOptional()
  @IsEnum(JobType)
  job_type?: JobType;

  @IsOptional()
  @IsEnum(ExperienceLevel)
  experience_level?: ExperienceLevel;

  @IsOptional()
  @IsEnum(RemoteFilter)
  remote?: RemoteFilter;

  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsString()
  location_radius?: string;
}

export class DiscoverJobsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LinkedInJobQueryDto)
  queries: LinkedInJobQueryDto[];

  @IsOptional()
  @IsString()
  notifyUrl?: string;
}

export class DiscoverJobsSyncDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LinkedInJobQueryDto)
  queries: LinkedInJobQueryDto[];
}
