interface FAQItem {
  question: string;
  answer: string;
}

const faqItems: FAQItem[] = [
  {
    question: 'How do I book tickets?',
    answer:
      "Browse through our event listings, select your preferred event, choose your seats, and complete the checkout process. You'll receive your e-ticket instantly via email.",
  },
  {
    question: 'Can I cancel or refund my ticket?',
    answer:
      'Refund policies vary by event. Generally, tickets can be refunded up to 48 hours before the event starts. Please check the specific event page for detailed refund terms or contact our support team for assistance.',
  },
  {
    question: 'How will I receive my tickets?',
    answer:
      'After completing your purchase, you will receive an email with your e-tickets as a PDF attachment. You can also access your tickets anytime by logging into your account and viewing your order history.',
  },
  {
    question: 'What payment methods do you accept?',
    answer:
      'We accept all major credit cards (Visa, Mastercard, American Express), debit cards, and mobile payment options. All transactions are securely processed through our encrypted payment gateway.',
  },
];

export function FAQ() {
  return (
    <section className="bg-white border-y border-stone-200 mt-20">
      <div className="max-w-3xl mx-auto px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-stone-900">
            Frequently Asked Questions
          </h2>
          <p className="text-stone-600 mt-3 text-lg">
            Everything you need to know about booking events
          </p>
        </div>

        <div className="space-y-6">
          {faqItems.map((item, index) => (
            <details
              key={index}
              className="group border border-stone-200 rounded-lg overflow-hidden hover:border-amber-300 transition"
            >
              <summary className="flex cursor-pointer items-center justify-between p-6 bg-stone-50 group-open:bg-amber-50 transition">
                <span className="text-lg font-semibold text-stone-900">
                  {item.question}
                </span>
                <svg
                  className="w-5 h-5 text-stone-600 group-open:rotate-180 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                </svg>
              </summary>
              <div className="px-6 py-4 text-stone-600">
                <p>{item.answer}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
