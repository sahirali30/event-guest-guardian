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
