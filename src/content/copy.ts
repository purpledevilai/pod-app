
export const copy = {
    screens: {
        start: {
            tagline: 'Everything\nbecomes\nsomething.',
            cta: 'Get Started',
        },
        welcome: {
            title: 'Welcome to pod recycling',
            bodyMd: `
  We\u2019re so glad you\u2019re here.

  Everything becomes something. Every item you throw away has two possible futures: renewed as a valuable resource, or buried in landfill. pod recycling helps you make the right choice\u2014easily, confidently, and consistently.

  Because when small actions become daily habits, real change and impact becomes possible.

  And it starts right here, with you, in your home.

  Join us, and let\u2019s begin.
        `.trim(),
            ctaNext: 'Next',
        },
        email: {
            title: "What\u2019s your email?",
            bodyMd:
                "We\u2019ll use it to create your pod recycling account.\n\nWith a pod recycling account, we can personalize your journey and help you track your impact over time.",
            placeholder: 'Email',
            ctaSend: 'Send Verification Code',
            ctaSubmitting: 'Sending\u2026',
            errorInvalid: 'Please enter a valid email.',
        },
        verify: {
            title: "Check your inbox",
            bodyMd: "We\u2019ve sent a 6-digit code to your email.\n\nEnter it below to confirm your place in the pod recycling community.\n\nCan\u2019t find the code? Check your spam or junk folder \u2014 or tap below to resend it.",
            resend: "resend code",
            useDifferentEmail: "use a different email",
            ctaSubmitting: 'Verifying\u2026',
            ctaContinue: 'Verify and Continue',
        },
        foreword: {
            title: "Welcome, we\u2019re glad you\u2019re here",
            foreword: "Foreword",
            bodyMd: `When you place something in a recycling bin, it\u2019s not the end \u2014 it\u2019s the beginning.

pod recycling was built for the moments that matter \u2014 standing at the bin, wondering what goes where.

No confusion. No hesitation. Just quick answers that help you sort correctly with confidence.

Over time, those small decisions become second nature. And when recycling becomes a habit, your impact becomes real.

And it all starts with you \u2014 at the \u201CPoint of Disposal\u201D.
That\u2019s what pod stands for.
Because when you know what to do in the moment, you help to turn waste into valuable resource, contribute to our circular economy and create a sustainable environment for our future.
`,
            ctaContinue: 'Got it \u2014 show me how',
        },
        postcode: {
            title: "What\u2019s your post code?",
            bodyMd: "With your post code, we can look up your council \u2014 and the specific bin systems available in your area.",
            placeholder: 'Post code',
            ctaLookUp: 'Look up councils',
            ctaSubmitting: 'Looking up\u2026',
            errorInvalid: 'Please enter a valid post code.',
        },
        council: {
            title: "Which council are you in?",
            subtitle: "We found a few councils associated with that post code.",
            description: "Select yours to get the most accurate bin guidance.",
            ctaContinue: "Look up bin systems",
            ctaSubmitting: "Looking up\u2026"
        },
        binSystem: {
            title: "Which bin system do you use?",
            ctaContinue: "Choose bin system",
            ctaSubmitting: "Choosing\u2026"
        }
    },
} as const;
export type AppCopy = typeof copy;
