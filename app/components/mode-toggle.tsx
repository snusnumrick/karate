import { forwardRef } from "react"; // Import forwardRef
import {Moon, Sun} from "lucide-react";
import {useTheme} from "~/components/theme-provider";
import {Button} from "~/components/ui/button";
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,} from "~/components/ui/dropdown-menu";

// Wrap the component with forwardRef
export const ModeToggle = forwardRef<HTMLButtonElement>((props, ref) => {
    const {setTheme} = useTheme();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                {/* Pass the ref to the Button */}
                <Button variant="outline" size="icon" ref={ref} {...props}>
                    <Sun
                        className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0"/>
                    <Moon
                        className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"/>
                    <span className="sr-only">Toggle theme</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme("light")}>
                    Light
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")}>
                    Dark
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")}>
                    System
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
});

// Add display name for better debugging
ModeToggle.displayName = "ModeToggle";
