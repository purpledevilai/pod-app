export const copy = {
    screens: {
        start: {
            tagline: 'Everything\nbecomes\nsomething.',
            cta: 'Get Started',
        },
        welcome: {
            title: 'Welcome to Pod',
            bodyMd: `
  We’re so glad you’re here.
  
  Pod is more than an app — it’s a **community** committed to transforming how we relate to materials in our lives.
  
  Every day, we extract more from the Earth — while landfills overflow with untapped potential. *But it doesn’t have to be that way.*
  
  We believe that with better guidance, we can all make choices that integrate with — not work against — our planet’s ecosystem.
  
  And it starts right here, with you, in your home.
  
  Join us, and let’s begin.
        `.trim(),
            ctaNext: 'Next',
        },
        email: {
            title: "What's your email?",
            bodyMd:
                "We’ll use it to create your Pod account — or pick up if you already have one.\n\nWith a Pod account, we can personalize your journey, save your bin system, and help you track your impact over time.",
            placeholder: 'Email',
            ctaSend: 'Send Verification Code',
            ctaSubmitting: 'Sending…',
            errorInvalid: 'Please enter a valid email.',
        },
        verify: {
            title: "Check your inbox",
            bodyMd: "We’ve sent a 6-digit code to your email.\n\nEnter it below to confirm your spot in the Pod community.\n\nCan’t find the code? Check your spam or junk folder — or tap below to resend it.",
            resend: "resend code",
            useDifferentEmail: "use a different email",
            ctaSubmitting: 'Verifying…',
            ctaContinue: 'Verify and Continue',
        },
        foreword: {
            title: "Welcome, we're glad you're here",
            foreword: "Foreword",
            bodyMd: `When you place something in a recycling bin, it’s not the end — it’s the beginning.

Your recycling is taken to a Material Recovery Facility (MRF), where it’s sorted — either by advanced machines or by hand.
But here’s the catch: not all MRFs accept the same materials. It depends on your council and their local processing capabilities. That’s why some areas have glass-only bins, and others don’t.

The challenge?
Material quality. The cleaner and more accurate the sorting, the more valuable those materials become — and the more likely they are to be reused.

And it all starts with you — at the Point of Disposal.
That’s what POD stands for.
Because when you know what to do in the moment, you create a cleaner stream — and a stronger circular economy.
`,
            ctaContinue: 'Got it — show me how',
        }
    },
} as const;
export type AppCopy = typeof copy;