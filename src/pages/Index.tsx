import EventRegistration from "@/components/EventRegistration";

const Index = () => {
  return (
    <div className="min-h-screen py-8 px-4" style={{background: 'var(--gradient-bg)'}}>
      <div className="container mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-6">
            <div className="flex items-center space-x-4">
              <img src="/lovable-uploads/41378f9d-db71-4814-8ea0-835eac6a7179.png" alt="Modi Ventures Logo" className="h-10 w-auto" />
              <h1 className="text-2xl font-semibold tracking-wider text-foreground">MODI VENTURES</h1>
            </div>
          </div>
          <div className="mb-6">
            <img 
              src="/lovable-uploads/a81b69b9-b56b-4d0c-ade7-ddecf01dcc0c.png" 
              alt="Modi Ventures Annual Gathering" 
              className="w-full max-w-4xl mx-auto rounded-lg shadow-lg"
            />
          </div>
          <p className="text-xl text-muted-foreground">Register for our annual investor meeting and reception</p>
        </div>
        <EventRegistration />
      </div>
    </div>
  );
};

export default Index;
