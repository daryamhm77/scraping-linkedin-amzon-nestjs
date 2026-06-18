import {
  ExperienceLevel,
  JobType,
  RemoteFilter,
  TimeRange,
} from '../types/linkedin';

export interface LinkedInJobQuery {
  location: string;
  keyword: string;
  country?: string;
  time_range?: TimeRange;
  job_type?: JobType;
  experience_level?: ExperienceLevel;
  remote?: RemoteFilter;
  company?: string;
  location_radius?: string;
}

export interface LinkedInJob {
  job_id?: string;
  title?: string;
  company?: string;
  location?: string;
  url?: string;
  description?: string;
  posted_date?: string;
  employment_type?: string;
  seniority_level?: string;
  industry?: string;
  job_functions?: string[];
  applicant_count?: number;
  [key: string]: unknown;
}

export interface BrightDataResponse {
  snapshot_id?: string;
  status?: string;
  data?: LinkedInJob[];
}
