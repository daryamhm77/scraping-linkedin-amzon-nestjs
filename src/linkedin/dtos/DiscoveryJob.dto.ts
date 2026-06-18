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
  @IsEnum(['Past month', 'Past week', 'Past 24 hours', 'Any time'])
  time_range?: TimeRange;

  @IsOptional()
  @IsEnum([
    'Full-time',
    'Part-time',
    'Contract',
    'Temporary',
    'Internship',
    'Volunteer',
  ])
  job_type?: JobType;

  @IsOptional()
  @IsEnum([
    'Internship',
    'Entry level',
    'Associate',
    'Mid-Senior level',
    'Director',
    'Executive',
  ])
  experience_level?: ExperienceLevel;

  @IsOptional()
  @IsEnum(['On-site', 'Remote', 'Hybrid'])
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
