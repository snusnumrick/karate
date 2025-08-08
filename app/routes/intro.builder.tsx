import { useState } from "react";
import { Link } from "@remix-run/react";
import { siteConfig } from "~/config/site";
import type { MetaArgs, MetaDescriptor, MetaFunction } from "@remix-run/node";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { mergeMeta } from "~/utils/meta";
import { Copy, ExternalLink, Calendar, DollarSign, Clock, Users, Plus, X, Settings } from 'lucide-react';
import { useClientReady } from "~/hooks/use-client-ready";

export const meta: MetaFunction = (args: MetaArgs) => {
    const parentMatch = args.matches.find((match) => match.id === "root");
    const parentMeta = parentMatch?.meta || [];

    const builderMeta: MetaDescriptor[] = [
        { title: "Landing Page URL Builder | Greenegin Karate" },
        {
            name: "description",
            content: "Generate customized URLs for introductory karate program landing pages with your specific dates, prices, and program details."
        },
        { property: "og:title", content: "Landing Page URL Builder | Greenegin Karate" },
        { property: "og:description", content: "Generate customized URLs for introductory karate program landing pages." },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${siteConfig.url}/intro/builder` },
        { tagName: "link", rel: "canonical", href: `${siteConfig.url}/intro/builder` },
    ];

    return mergeMeta(parentMeta, builderMeta);
};

interface ProgramSeries {
    id: string;
    dates: string;
}

export default function URLBuilderPage() {
    const isClient = useClientReady();
    
    const [programSeries, setProgramSeries] = useState<ProgramSeries[]>([
        { id: "series1", dates: "September 9-26, 2024" },
        { id: "series2", dates: "February 3-20, 2025" }
    ]);
    
    const [formData, setFormData] = useState({
        price: "89",
        sessions: "8",
        duration: "45",
        frequency: "2"
    });

    const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSeriesChange = (seriesId: string, dates: string) => {
        setProgramSeries(prev => 
            prev.map(series => 
                series.id === seriesId ? { ...series, dates } : series
            )
        );
    };

    const addSeries = () => {
        const newId = `series${programSeries.length + 1}`;
        setProgramSeries(prev => [...prev, { id: newId, dates: "" }]);
    };

    const removeSeries = (seriesId: string) => {
        if (programSeries.length > 1) {
            setProgramSeries(prev => prev.filter(series => series.id !== seriesId));
        }
    };

    // Generate series names based on entered dates
    const generateSeriesName = (dateString: string): string => {
        if (!dateString.trim()) return "Program Series";
        
        // Extract month from various date formats
        const monthRegex = /(January|February|March|April|May|June|July|August|September|October|November|December)/i;
        const match = dateString.match(monthRegex);
        
        if (match) {
            return `${match[1]} Series`;
        }
        
        // Fallback: try to extract month abbreviations
        const monthAbbrevRegex = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i;
        const abbrevMatch = dateString.match(monthAbbrevRegex);
        
        if (abbrevMatch) {
            const monthMap: { [key: string]: string } = {
                'Jan': 'January', 'Feb': 'February', 'Mar': 'March', 'Apr': 'April',
                'May': 'May', 'Jun': 'June', 'Jul': 'July', 'Aug': 'August',
                'Sep': 'September', 'Oct': 'October', 'Nov': 'November', 'Dec': 'December'
            };
            return `${monthMap[abbrevMatch[1]]} Series`;
        }
        
        // If no month found, return a generic name
        return "Program Series";
    };

    const generateURL = (program: 'elementary' | 'adaptive' | 'daycare') => {
        if (!isClient) return '';
        
        const params = new URLSearchParams({
            price: formData.price,
            sessions: formData.sessions,
            duration: formData.duration,
            frequency: formData.frequency
        });

        // Add series data dynamically
        programSeries.forEach((series, index) => {
            if (series.dates.trim()) {
                params.set(`series${index + 1}`, series.dates);
            }
        });
        
        return `${window.location.origin}/intro/${program}?${params.toString()}`;
    };

    const copyToClipboard = async (url: string) => {
        try {
            await navigator.clipboard.writeText(url);
            setCopiedUrl(url);
            setTimeout(() => setCopiedUrl(null), 2000);
        } catch (err) {
            console.error('Failed to copy URL:', err);
        }
    };

    const programs = [
        {
            id: 'elementary' as const,
            title: 'Elementary Schools',
            description: 'Perfect for K-12 schools looking to enhance their physical education programs',
            icon: '🏫',
            color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
        },
        {
            id: 'adaptive' as const,
            title: 'Adaptive Programs',
            description: 'Specialized programs for students with special needs and therapeutic goals',
            icon: '🌟',
            color: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'
        },
        {
            id: 'daycare' as const,
            title: 'Day Cares',
            description: 'Age-appropriate programs for early childhood development (ages 3-6)',
            icon: '🧸',
            color: 'bg-pink-50 dark:bg-pink-900/20 border-pink-200 dark:border-pink-800'
        }
    ];

    return (
        <div className="page-background-styles">
            {/* Minimal Header */}
            <div className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-center">
                        <Link to="/" className="flex items-center">
                            <div className="relative h-10 w-53 mr-4">
                                <img
                                    src="/logo-light.svg"
                                    alt="Karate Greenegin Logo - Kids Martial Arts Victoria BC"
                                    className="h-10 w-53 dark:hidden"
                                />
                                <img
                                    src="/logo-dark.svg"
                                    alt="Karate Greenegin Logo - Kids Martial Arts Victoria BC, Dark Mode"
                                    className="h-10 w-53 hidden dark:block"
                                />
                            </div>
                            <div className="text-center">
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    High-Performance Martial Arts Academy
                                </p>
                            </div>
                        </Link>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-extrabold page-header-styles sm:text-5xl mb-4">
                        Landing Page URL Builder
                    </h1>
                    <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
                        Customize your introductory karate program details and generate personalized URLs to share with potential clients
                    </p>
                </div>

                <div className="grid lg:grid-cols-2 gap-8">
                    {/* Configuration Panel */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center">
                                    <Settings className="mr-2 h-5 w-5 text-green-600" />
                                    Program Configuration
                                </CardTitle>
                                <CardDescription>
                                    Set your program details that will be displayed on all landing pages
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Program Series Configuration */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-base font-semibold flex items-center">
                                            <Calendar className="mr-2 h-4 w-4 text-blue-500" />
                                            Program Series
                                        </Label>
                                        <Button
                                            onClick={addSeries}
                                            variant="outline"
                                            size="sm"
                                            className="flex items-center"
                                        >
                                            <Plus className="mr-1 h-4 w-4" />
                                            Add Series
                                        </Button>
                                    </div>
                                    <div className="space-y-3">
                                        {programSeries.map((series, index) => (
                                            <div key={series.id} className="flex gap-2 items-end">
                                                <div className="flex-1">
                                                    <Label htmlFor={`series-${series.id}`} className="text-sm text-gray-600 dark:text-gray-400">
                                                        {generateSeriesName(series.dates) || `Series ${index + 1}`}
                                                    </Label>
                                                    <Input
                                                        id={`series-${series.id}`}
                                                        value={series.dates}
                                                        onChange={(e) => handleSeriesChange(series.id, e.target.value)}
                                                        placeholder="e.g., September 9-26, 2024"
                                                        className="input-custom-styles"
                                                    />
                                                </div>
                                                {programSeries.length > 1 && (
                                                    <Button
                                                        onClick={() => removeSeries(series.id)}
                                                        variant="outline"
                                                        size="sm"
                                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        Add multiple program series for different months or time periods. Each series will be displayed as a separate option on your landing pages.
                                    </p>
                                </div>

                                {/* Pricing Configuration */}
                                <div className="space-y-3">
                                    <Label htmlFor="price" className="text-base font-semibold flex items-center">
                                        <DollarSign className="mr-2 h-4 w-4 text-green-500" />
                                        Price (CAD, before tax)
                                    </Label>
                                    <Input
                                        id="price"
                                        value={formData.price}
                                        onChange={(e) => handleInputChange('price', e.target.value)}
                                        placeholder="e.g., 89"
                                        className="input-custom-styles"
                                    />
                                    <p className="text-sm text-gray-500">Will display as &ldquo;${formData.price} + PST&rdquo;</p>
                                </div>

                                {/* Program Details */}
                                <div className="space-y-4">
                                    <Label className="text-base font-semibold flex items-center">
                                        <Clock className="mr-2 h-4 w-4 text-orange-500" />
                                        Program Structure
                                    </Label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <Label htmlFor="sessions" className="text-sm text-gray-600 dark:text-gray-400">
                                                Number of Sessions
                                            </Label>
                                            <Input
                                                id="sessions"
                                                value={formData.sessions}
                                                onChange={(e) => handleInputChange('sessions', e.target.value)}
                                                placeholder="e.g., 8"
                                                className="input-custom-styles"
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="duration" className="text-sm text-gray-600 dark:text-gray-400">
                                                Duration (minutes)
                                            </Label>
                                            <Input
                                                id="duration"
                                                value={formData.duration}
                                                onChange={(e) => handleInputChange('duration', e.target.value)}
                                                placeholder="e.g., 45"
                                                className="input-custom-styles"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <Label htmlFor="frequency" className="text-sm text-gray-600 dark:text-gray-400">
                                            Classes per Week
                                        </Label>
                                        <Input
                                            id="frequency"
                                            value={formData.frequency}
                                            onChange={(e) => handleInputChange('frequency', e.target.value)}
                                            placeholder="e.g., 2"
                                            className="input-custom-styles"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* URL Generation Panel */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center">
                                    <Users className="mr-2 h-5 w-5 text-purple-600" />
                                    Generated URLs
                                </CardTitle>
                                <CardDescription>
                                    Copy these URLs to share with your target audiences
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {programs.map((program) => {
                                        const url = generateURL(program.id);
                                        const isCopied = copiedUrl === url;
                                        
                                        return (
                                            <div key={program.id} className={`p-4 rounded-lg border-2 ${program.color}`}>
                                                <div className="flex items-start justify-between mb-3">
                                                    <div>
                                                        <h3 className="font-semibold text-lg flex items-center">
                                                            <span className="mr-2">{program.icon}</span>
                                                            {program.title}
                                                        </h3>
                                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                                            {program.description}
                                                        </p>
                                                    </div>
                                                </div>
                                                
                                                <div className="bg-white dark:bg-gray-800 p-3 rounded border font-mono text-sm break-all mb-3">
                                                    {isClient ? (url || "Generating URL...") : "Loading..."} 
                                                </div>
                                                
                                                <div className="flex gap-2">
                                                    <Button
                                                        onClick={() => copyToClipboard(url)}
                                                        variant="outline"
                                                        size="sm"
                                                        className="flex-1"
                                                        disabled={!isClient || !url}
                                                    >
                                                        <Copy className="mr-2 h-4 w-4" />
                                                        {isCopied ? "Copied!" : "Copy URL"}
                                                    </Button>
                                                    <Button
                                                        asChild
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={!isClient || !url}
                                                    >
                                                        <a href={url || '#'} target="_blank" rel="noopener noreferrer">
                                                            <ExternalLink className="h-4 w-4" />
                                                        </a>
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Preview Section */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Quick Preview</CardTitle>
                                <CardDescription>
                                    How your configuration will appear on the landing pages
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 p-6 rounded-lg">
                                    <h3 className="font-semibold mb-4">Program Details Preview:</h3>
                                    <div className="space-y-2 text-sm">
                                        {programSeries.map((series, index) => (
                                            <div key={series.id} className="flex justify-between">
                                                <span className="text-gray-600 dark:text-gray-400">
                                                    {generateSeriesName(series.dates) || `Series ${index + 1}`}:
                                                </span>
                                                <span className="font-medium">{series.dates || "Not set"}</span>
                                            </div>
                                        ))}
                                        {programSeries.length === 0 && (
                                            <div className="text-gray-500 italic">No program series configured</div>
                                        )}
                                        <div className="border-t pt-2 mt-3">
                                            <div className="flex justify-between">
                                                <span className="text-gray-600 dark:text-gray-400">Price:</span>
                                                <span className="font-medium">${formData.price} + PST</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600 dark:text-gray-400">Program:</span>
                                                <span className="font-medium">{formData.sessions} sessions, {formData.duration} minutes each</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600 dark:text-gray-400">Frequency:</span>
                                                <span className="font-medium">{formData.frequency} classes per week</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Instructions */}
                <Card className="mt-8">
                    <CardHeader>
                        <CardTitle>How to Use</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid md:grid-cols-3 gap-6">
                            <div className="text-center">
                                <div className="bg-green-100 dark:bg-green-900/20 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <span className="text-2xl">1️⃣</span>
                                </div>
                                <h3 className="font-semibold mb-2">Configure Details</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Update the program dates, pricing, and session details in the configuration panel
                                </p>
                            </div>
                            <div className="text-center">
                                <div className="bg-blue-100 dark:bg-blue-900/20 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <span className="text-2xl">2️⃣</span>
                                </div>
                                <h3 className="font-semibold mb-2">Copy URLs</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Copy the generated URLs for the specific audience you want to target
                                </p>
                            </div>
                            <div className="text-center">
                                <div className="bg-purple-100 dark:bg-purple-900/20 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <span className="text-2xl">3️⃣</span>
                                </div>
                                <h3 className="font-semibold mb-2">Share & Track</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Share the URLs via email, social media, or direct messaging instead of PDF files
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}