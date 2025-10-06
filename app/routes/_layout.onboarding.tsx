import {json, redirect, type LoaderFunctionArgs} from "@remix-run/node";
import {Link, useLoaderData} from "@remix-run/react";
import {Button} from "~/components/ui/button";
import {Alert, AlertDescription, AlertTitle} from "~/components/ui/alert";
import {getSupabaseServerClient} from "~/utils/supabase.server";
import {siteConfig} from "~/config/site";

type LoaderData = {
    preferredName: string | null;
    supportEmail: string;
};

export async function loader({request}: LoaderFunctionArgs) {
    const {supabaseServer, response: {headers}} = getSupabaseServerClient(request);
    const {data: {user}} = await supabaseServer.auth.getUser();

    if (!user) {
        return redirect(`/login?redirectTo=${encodeURIComponent('/onboarding')}`);
    }

    const {data: profile, error} = await supabaseServer
        .from('profiles')
        .select('family_id, role, first_name, last_name')
        .eq('id', user.id)
        .single();

    if (error || !profile) {
        console.error('Unable to load profile for onboarding:', error?.message);
        return json({preferredName: null, supportEmail: siteConfig.contact.email}, {status: 500, headers});
    }

    if (profile.role === 'admin') {
        return redirect('/admin', {headers});
    }

    if (profile.role === 'instructor') {
        return redirect('/instructor', {headers});
    }

    if (profile.family_id) {
        return redirect('/family', {headers});
    }

    const preferredName = profile.first_name || profile.last_name || null;

    return json<LoaderData>({
        preferredName,
        supportEmail: siteConfig.contact.email,
    }, {headers});
}

export default function OnboardingPage() {
    const {preferredName, supportEmail} = useLoaderData<typeof loader>();

    return (
        <div className="min-h-screen page-background-styles py-12">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
                <div className="text-center space-y-3">
                    <h1 className="text-3xl font-extrabold text-primary-700 dark:text-primary-300">
                        {preferredName ? `Welcome, ${preferredName}!` : 'Welcome!'}
                    </h1>
                    <p className="text-lg text-muted-foreground">
                        We noticed you haven&apos;t connected your account to a family yet. Let&apos;s get you set up so you can access the right dashboard.
                    </p>
                </div>

                <div className="grid gap-6">
                    <div className="rounded-lg border border-border bg-card shadow-sm p-6 space-y-4">
                        <h2 className="text-xl font-semibold text-foreground">I&#39;m managing a family</h2>
                        <p className="text-muted-foreground">
                            Create or claim your family account to add guardians, register students, and manage payments.
                        </p>
                        <Button asChild size="lg">
                            <Link to="/family/create">Start family setup</Link>
                        </Button>
                    </div>

                    <Alert>
                        <AlertTitle>Need a different type of access?</AlertTitle>
                        <AlertDescription>
                            Instructors, staff, or adult-only participants should reach out to us at{' '}
                            <a href={`mailto:${supportEmail}`} className="font-medium underline">
                                {supportEmail}
                            </a>{' '}
                            so we can finish configuring your account.
                        </AlertDescription>
                    </Alert>

                    <div className="flex items-center justify-between rounded-lg border border-dashed border-border p-4">
                        <div>
                            <p className="font-medium text-foreground">Not sure what to do?</p>
                            <p className="text-sm text-muted-foreground">
                                You can return to the home page or sign out and come back later.
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button asChild variant="outline">
                                <Link to="/">Home</Link>
                            </Button>
                            <Button asChild variant="ghost">
                                <Link to="/logout">Sign out</Link>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
