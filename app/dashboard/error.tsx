'use client'

import { useEffect } from 'react'

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error("Dashboard Error:", error)
    }, [error])

    return (
        <div className="p-8 bg-black min-h-screen text-white flex flex-col items-center justify-center">
            <h2 className="text-2xl font-bold text-red-500 mb-4">Something went wrong!</h2>
            <div className="bg-neutral-900 p-4 rounded mb-4 overflow-auto max-w-2xl border border-red-900">
                <p className="font-mono text-red-200">{error.message}</p>
                <pre className="font-mono text-xs text-neutral-500 mt-2 whitespace-pre-wrap">{error.stack}</pre>
            </div>
            <button
                onClick={
                    // Attempt to recover by trying to re-render the segment
                    () => reset()
                }
                className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-500"
            >
                Try again
            </button>
        </div>
    )
}
