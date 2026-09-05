import { IsIn } from 'class-validator';
import { DateRangeQueryDto } from 'src/common/date/date-range-query.dto';

export class ExportReportQueryDto extends DateRangeQueryDto {
  @IsIn(['csv', 'xlsx'])
  format: 'csv' | 'xlsx';
}
