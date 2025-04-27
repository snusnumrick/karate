import {Button} from "~/components/ui/button";
import {Separator} from "~/components/ui/separator";
import {Link} from "@remix-run/react";

export default function AdminFooter() {
    return (
        <footer className="bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-auto">
            <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
                <Separator className="my-4 bg-gray-300 dark:bg-gray-600"/>
                <div className="text-center text-gray-500 dark:text-gray-400 text-sm">
                    <Button variant="link" className="text-gray-500 dark:text-gray-400 p-0 h-auto">
                        <Link to="https://www.ponto.studio/">&copy; {new Date().getFullYear()} Ponto Studio. All rights reserved.</Link>
                    </Button>
                </div>
            </div>
        </footer>
    );
}
