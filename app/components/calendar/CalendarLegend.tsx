import { getEligibilityBorderColor } from "./utils";

export interface CalendarLegendProps {
  className?: string;
}

export function CalendarLegend({ className = "" }: CalendarLegendProps) {
  return (
    <div className={`form-container-styles p-4 sm:p-6 lg:p-8 backdrop-blur-lg ${className}`}>
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4 pb-2 border-b border-border">CALENDAR LEGEND</h2>
        
        {/* Class Status Legend */}
        <div className="mb-6">
          <h3 className="text-base font-medium text-foreground mb-3">Class Status</h3>
          <div className="space-y-3 sm:grid sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3 sm:gap-4 sm:space-y-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <div className="px-3 py-2 bg-blue-100 dark:bg-blue-900/30 border-l-4 border-blue-500 dark:border-blue-400 rounded text-sm text-blue-900 dark:text-blue-100 font-medium flex-shrink-0">
                Scheduled
              </div>
              <span className="text-muted-foreground text-sm">Scheduled class</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <div className="px-3 py-2 bg-green-100 dark:bg-green-900/30 border-l-4 border-green-500 dark:border-green-400 rounded text-sm text-green-900 dark:text-green-100 font-medium flex-shrink-0">
                Completed
              </div>
              <span className="text-muted-foreground text-sm">Completed class</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <div className="px-3 py-2 bg-red-100 dark:bg-red-900/30 border-l-4 border-red-500 dark:border-red-400 rounded text-sm text-red-900 dark:text-red-100 font-medium flex-shrink-0">
                Cancelled
              </div>
              <span className="text-muted-foreground text-sm">Cancelled class</span>
            </div>
          </div>
        </div>

        {/* Event Registration Status Legend */}
        <div className="mb-6">
          <h3 className="text-base font-medium text-foreground mb-3">Event Registration Status</h3>
          <div className="space-y-3 sm:grid sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3 sm:gap-4 sm:space-y-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <div className={`px-3 py-2 bg-purple-100 dark:bg-purple-900/30 border-l-4 ${getEligibilityBorderColor('eligible')} rounded text-sm text-purple-900 dark:text-purple-100 font-medium flex-shrink-0`}>
                Can Register
              </div>
              <span className="text-muted-foreground text-sm">At least one student can register</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <div className={`px-3 py-2 bg-purple-100 dark:bg-purple-900/30 border-l-4 ${getEligibilityBorderColor('all_registered')} rounded text-sm text-purple-900 dark:text-purple-100 font-medium flex-shrink-0`}>
                All Registered
              </div>
              <span className="text-muted-foreground text-sm">All eligible students already registered</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <div className={`px-3 py-2 bg-purple-100 dark:bg-purple-900/30 border-l-4 ${getEligibilityBorderColor('not_eligible')} rounded text-sm text-purple-900 dark:text-purple-100 font-medium flex-shrink-0`}>
                Not Eligible
              </div>
              <span className="text-muted-foreground text-sm">No students can register</span>
            </div>
          </div>
        </div>

        {/* Other Event Types Legend */}
        <div>
          <h3 className="text-base font-medium text-foreground mb-3">Other Events</h3>
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <div className="px-3 py-2 bg-pink-100 dark:bg-pink-900/30 border-l-4 border-pink-500 dark:border-pink-400 rounded text-sm text-pink-900 dark:text-pink-100 font-medium flex-shrink-0">
                Birthday
              </div>
              <span className="text-muted-foreground text-sm">Student birthday</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}