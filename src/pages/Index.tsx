import EventRegistration from "@/components/EventRegistration";
import ModiLogo from "@/assets/modi-logo.svg";

const Index = () => {
  return (
    <div className="min-h-screen py-8 px-4" style={{background: 'var(--gradient-bg)'}}>
      <div className="container mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-6">
            <div className="flex items-center space-x-4">
              <img src={ModiLogo} alt="Modi Ventures Logo" className="w-10 h-10 text-foreground" />
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
          <p className="text-xl text-muted-foreground">Register for our exclusive live event</p>
        </div>
        <EventRegistration />
      </div>
    </div>
  );
};

export default Index;
