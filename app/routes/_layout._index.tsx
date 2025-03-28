import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";

export const meta: MetaFunction = () => {
  return [
    { title: "Karate Classes - Sensei Negin" },
    { name: "description", content: "Discover the art of karate with Sensei Negin at Lighthouse Christian Academy. Classes for children ages 6-12." },
  ];
};

export default function Index() {
  return (
    <div className="bg-amber-50 dark:bg-gray-800">
      {/* Hero Section */}
      <div className="bg-green-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="flex items-center mb-6">
                <img src="/logo.svg" alt="Karate Greenegin Logo" className="h-24 w-24 mr-4" />
                <h1 className="text-4xl md:text-5xl font-bold">
                  DISCOVER <br/> THE ART OF <br/> THE &ldquo;EMPTY HAND&rdquo;
                </h1>
              </div>
              <p className="text-xl mb-8">
                &ldquo;This class is an introduction to one of the most sophisticated martial arts ‒ the Art of Karate.
                While karate focuses on defence techniques, its teaching goes far beyond fighting&rdquo;
              </p>
              <Link 
                to="/register"
                className="inline-block bg-white text-green-600 font-bold py-3 px-8 rounded-lg text-lg hover:bg-gray-100 transition"
              >
                Join us! OSS!
              </Link>
            </div>
            <div className="flex justify-center">
              <div className="relative h-96 w-full">
                <div className="absolute left-10 right-0 top-0 h-full w-full bg-green-700 transform -skew-x-12 origin-top-right z-0"></div>
                <div className="absolute right-8 top-8 h-80 w-80 flex items-center justify-center z-10">
                  <div className="text-right flex items-left">

                    <div>
                      <h2 className="text-5xl font-bold">KARATE <br/>GREENEGIN</h2>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Class Info Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="bg-white dark:bg-gray-700 p-8 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold text-green-600 dark:text-green-400 mb-4">Class Details</h2>
            <ul className="space-y-4 text-lg">
              <li className="flex items-center">
                <span className="mr-2">📍</span>
                <span>Lighthouse Christian Academy</span>
              </li>
              <li className="flex items-center">
                <span className="mr-2">🕕</span>
                <span>Mon & Wed at 6 p.m</span>
              </li>
              <li className="flex items-center">
                <span className="mr-2">👧👦</span>
                <span>Ages 6-12 y/o</span>
              </li>
              <li className="flex items-center">
                <span className="mr-2">📞</span>
                <span>(604) 690-7121</span>
              </li>
              <li className="flex items-center">
                <span className="mr-2">✉️</span>
                <span>info@greenegin.ca</span>
              </li>
            </ul>
          </div>
          
          <div>
            <h2 className="text-2xl font-bold text-green-600 dark:text-green-400 mb-6">
              DISCOVER THE HANDS BEHIND THE ART
            </h2>
            <div className="bg-green-600 text-white p-8 rounded-lg shadow-md">
              <h3 className="text-xl font-bold mb-4">SENSEI NEGIN</h3>
              <ul className="space-y-3">
                <li className="flex items-center">
                  <span className="mr-2">🥋</span>
                  <span>5th Dan Black Belt</span>
                </li>
                <li className="flex items-center">
                  <span className="mr-2">🎓</span>
                  <span>M.S. of Sport Psychology</span>
                </li>
                <li className="flex items-center">
                  <span className="mr-2">👶</span>
                  <span>Kids Sports Certified Coach</span>
                </li>
                <li className="flex items-center">
                  <span className="mr-2">🏆</span>
                  <span>Award Winning Youth Coach</span>
                </li>
                <li className="flex items-center">
                  <span className="mr-2">💪</span>
                  <span>Personal Trainer Certified</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Benefits Section */}
      <div className="bg-green-50 dark:bg-gray-700 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-green-600 dark:text-green-400 mb-12">
            Benefits of Karate Training
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white dark:bg-gray-700 p-6 rounded-lg shadow-md">
              <div className="text-4xl text-green-600 dark:text-green-400 mb-4">🧠</div>
              <h3 className="text-xl font-bold mb-2">Mental Strength</h3>
              <p>Develop focus, discipline, and confidence through consistent practice and achievement.</p>
            </div>
            <div className="bg-white dark:bg-gray-700 p-6 rounded-lg shadow-md">
              <div className="text-4xl text-green-600 dark:text-green-400 mb-4">🥋</div>
              <h3 className="text-xl font-bold mb-2">Self-Defense</h3>
              <p>Learn practical defense techniques while understanding the responsibility that comes with them.</p>
            </div>
            <div className="bg-white dark:bg-gray-700 p-6 rounded-lg shadow-md">
              <div className="text-4xl text-green-600 dark:text-green-400 mb-4">🏆</div>
              <h3 className="text-xl font-bold mb-2">Personal Growth</h3>
              <p>Whether for transformative or competitive purposes, karate nurtures champions in all aspects of life!</p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-green-600 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-6">Ready to Begin Your Karate Journey?</h2>
          <p className="text-xl mb-8 max-w-3xl mx-auto">
            Join Sensei Negin&apos;s karate class and discover the art of the &ldquo;empty hand&rdquo;
            while developing discipline,
            confidence, and physical fitness.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link 
              to="/register"
              className="inline-block bg-white text-green-600 font-bold py-3 px-8 rounded-lg text-lg hover:bg-gray-100 transition"
            >
              Register Now
            </Link>
            <Link 
              to="/contact" 
              className="inline-block bg-transparent border-2 border-white text-white font-bold py-3 px-8 rounded-lg text-lg hover:bg-white hover:text-green-600 transition"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
