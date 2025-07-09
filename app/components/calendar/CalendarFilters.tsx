import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import type { CalendarFiltersProps } from './types';

export function CalendarFilters({
  students,
  selectedStudentId,
  onStudentChange
}: CalendarFiltersProps) {
  if (!students || students.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      <div className="flex items-center space-x-4">
        <label htmlFor="student-filter" className="text-sm font-medium sm:pl-6">Filter by Student:</label>
        <Select
          value={selectedStudentId || 'all'}
          onValueChange={onStudentChange}
        >
          <SelectTrigger id="student-filter" className="w-48">
            <SelectValue placeholder="Select student" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Students</SelectItem>
            {students.map(student => (
              <SelectItem key={student.id} value={student.id}>
                {student.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}