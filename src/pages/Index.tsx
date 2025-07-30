// Update this page (the content is just a fallback if you fail to update the page)

import EventRegistration from "@/components/EventRegistration";

const Index = () => {
  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="container mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">MVC Live Event</h1>
          <p className="text-xl text-muted-foreground">Register for our exclusive event</p>
        </div>
        <EventRegistration />
      </div>
    </div>
  );
};

export default Index;
