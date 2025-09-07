import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="container py-16">
      <div className="max-w-md mx-auto text-center">
        <h1 className="text-5xl font-extrabold tracking-tight">404</h1>
        <p className="mt-3 text-muted-foreground">Oops! Page not found</p>
        <a href="/" className="inline-flex mt-6 text-primary underline underline-offset-4">Return home</a>
      </div>
    </div>
  );
};

export default NotFound;
