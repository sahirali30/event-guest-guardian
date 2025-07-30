// Update this page (the content is just a fallback if you fail to update the page)

import EventRegistration from "@/components/EventRegistration";

const Index = () => {
  return (
    <div className="min-h-screen py-8 px-4" style={{background: 'var(--gradient-bg)'}}>
      <div className="container mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-6">
            <div className="flex items-center space-x-3">
              <div className="text-primary text-3xl font-bold">≋</div>
              <h1 className="text-2xl font-semibold tracking-wider">MODI VENTURES</h1>
            </div>
          </div>
          <h2 className="text-4xl font-bold mb-4">
            investing at the{" "}
            <span className="italic text-primary">intersection</span>{" "}
            of tech and bio
          </h2>
          <p className="text-xl text-muted-foreground">Register for our exclusive live event</p>
        </div>
        <EventRegistration />
      </div>
    </div>
  );
};

export default Index;
