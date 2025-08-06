import type { MetaFunction } from "@remix-run/node";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { PWAStatus } from "~/components/PWAStatus";
import { Button } from "~/components/ui/button";
import { usePWAInstall } from "~/components/ServiceWorkerRegistration";
import { 
  Smartphone, 
  Zap, 
  Wifi, 
  Download, 
  Shield, 
  Bell
} from "lucide-react";

export const meta: MetaFunction = () => {
  return [
    { title: "Progressive Web App - Greenegin Karate" },
    { name: "description", content: "Learn about our Progressive Web App features and install the Greenegin Karate app for the best experience." },
  ];
};

export default function PWAInfo() {
  const { install, canInstall } = usePWAInstall();

  const handleInstall = async () => {
    await install();
  };

  const features = [
    {
      icon: <Smartphone className="h-6 w-6" />,
      title: "App-like Experience",
      description: "Enjoy a native app experience with smooth navigation and intuitive interface."
    },
    {
      icon: <Zap className="h-6 w-6" />,
      title: "Lightning Fast",
      description: "Instant loading with advanced caching technology for optimal performance."
    },
    {
      icon: <Wifi className="h-6 w-6" />,
      title: "Works Offline",
      description: "Access your family dashboard, class schedules, and more even without internet."
    },
    {
      icon: <Shield className="h-6 w-6" />,
      title: "Secure & Reliable",
      description: "Built with modern security standards and reliable service worker technology."
    },
    {
      icon: <Bell className="h-6 w-6" />,
      title: "Push Notifications",
      description: "Stay updated with new messages and important announcements instantly."
    },
    {
      icon: <Download className="h-6 w-6" />,
      title: "Easy Installation",
      description: "Install directly from your browser - no app store required."
    }
  ];

  return (
        <div className="page-background-styles py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold page-header-styles mb-4">
                        Greenegin Karate PWA
                    </h1>
                    <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
                        Install our Progressive Web App for the best experience. Get instant access to class schedules,
                        notifications, and more - even when you&apos;re offline!
                    </p>
                </div>

      {/* Installation Section */}
      {canInstall && (
        <Card className="form-container-styles mb-8 border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
          <CardHeader className="text-center">
            <CardTitle className="text-green-700 dark:text-green-300">
              Install Greenegin Karate App
            </CardTitle>
            <CardDescription>
              Get the full app experience with one click
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button 
              onClick={handleInstall}
              size="lg"
              className="bg-green-600 hover:bg-green-700"
            >
              <Download className="h-5 w-5 mr-2" />
              Install Now
            </Button>
            <p className="text-sm text-muted-foreground mt-2">
              Works on all modern browsers and devices
            </p>
          </CardContent>
        </Card>
      )}

      {/* Features Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {features.map((feature, index) => (
          <Card key={index} className="page-card-styles">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg text-green-600 dark:text-green-400">
                  {feature.icon}
                </div>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{feature.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* PWA Status */}
      <div className="mb-8">
        <PWAStatus />
      </div>

      {/* How to Install */}
      <Card className="page-card-styles">
        <CardHeader>
          <CardTitle>How to Install</CardTitle>
          <CardDescription>
            Follow these simple steps to install the app on your device
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Desktop */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                Desktop (Chrome, Edge, Safari)
              </h3>
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li>1. Click the install button above or look for the install icon in your browser&apos;s address bar</li>
                <li>2. Click &quot;Install&quot; in the popup dialog</li>
                <li>3. The app will be added to your desktop and start menu</li>
                <li>4. Launch it like any other app!</li>
              </ol>
            </div>

            {/* Mobile */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                Mobile (iOS Safari, Android Chrome)
              </h3>
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li>1. Open this site in your mobile browser</li>
                <li>2. Tap the share button (iOS) or menu (Android)</li>
                <li>3. Select &quot;Add to Home Screen&quot;</li>
                <li>4. Confirm the installation</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Benefits */}
      <Card className="page-card-styles mt-8">
        <CardHeader>
          <CardTitle>Why Use the PWA?</CardTitle>
          <CardDescription>
            Discover the advantages of our Progressive Web App
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium">For Parents</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Quick access to your family dashboard</li>
                <li>• View class schedules offline</li>
                <li>• Check attendance records anytime</li>
                <li>• Receive instant message notifications</li>
                <li>• Customize notification preferences</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">For Students</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Track your karate progress</li>
                <li>• View upcoming classes</li>
                <li>• Access belt requirements</li>
                <li>• Stay connected with the dojo</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Features */}
      <Card className="page-card-styles mt-8">
        <CardHeader>
          <CardTitle>Smart Notifications</CardTitle>
          <CardDescription>
            Stay connected with instant messaging notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium">Message Notifications</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Instant alerts for new messages</li>
                <li>• Works even when the app is closed</li>
                <li>• See sender name and message preview</li>
                <li>• Click to open conversation directly</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Customizable Settings</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Enable or disable notifications</li>
                <li>• Control notification sounds</li>
                <li>• Manage in your account settings</li>
                <li>• Respect browser notification preferences</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
    </div>
  );
}
