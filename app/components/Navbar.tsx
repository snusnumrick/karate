import { Link } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from "~/components/ui/sheet";
import { Menu } from "lucide-react";

export default function Navbar() {
  return (
    <nav className="bg-green-600 text-white shadow-md dark:bg-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center">
            <Button asChild variant="ghost" className="text-xl font-bold hover:bg-green-700">
              <Link to="/" className="text-white hover:text-green-200">
                KARATE GREENEGIN
              </Link>
            </Button>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden sm:flex gap-4 items-center">
            {['/', '/about', '/classes', '/register', '/contact'].map((path) => (
              <Button 
                key={path}
                asChild
                variant="ghost"
                className="text-white hover:bg-green-700 hover:text-green-200"
              >
                <Link to={path}>
                  {path === '/' ? 'Home' : path.slice(1).charAt(0).toUpperCase() + path.slice(2)}
                </Link>
              </Button>
            ))}
            <Button 
              asChild
              className="bg-white text-green-600 hover:bg-green-50 h-12 text-lg font-bold"
            >
              <Link to="/login">
                Login
              </Link>
            </Button>
          </div>

          {/* Mobile Navigation */}
          <Sheet>
            <SheetTrigger asChild className="sm:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6 text-white" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="bg-green-600 text-white">
              <div className="flex flex-col gap-4 pt-6">
                {['/', '/about', '/classes', '/register', '/contact'].map((path) => (
                  <SheetClose asChild key={path}>
                    <Button 
                      asChild
                      variant="ghost"
                      className="text-white justify-start hover:bg-green-700"
                    >
                      <Link to={path} className="w-full">
                        {path === '/' ? 'Home' : path.slice(1).charAt(0).toUpperCase() + path.slice(2)}
                      </Link>
                    </Button>
                  </SheetClose>
                ))}
                <Button 
                  asChild
                  className="bg-white text-green-600 hover:bg-green-50"
                >
                  <Link to="/login">
                    Login
                  </Link>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
