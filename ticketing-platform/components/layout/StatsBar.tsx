interface Stat {
  value: string;
  label: string;
}

const stats: Stat[] = [
  {
    value: '500+',
    label: 'Events Hosted',
  },
  {
    value: '50K+',
    label: 'Happy Customers',
  },
  {
    value: '99%',
    label: 'Satisfaction Rate',
  },
  {
    value: '24/7',
    label: 'Support Available',
  },
];

export function StatsBar() {
  return (
    <section className="bg-white border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <p className="text-3xl font-bold text-stone-900">{stat.value}</p>
              <p className="text-stone-600 text-sm mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
