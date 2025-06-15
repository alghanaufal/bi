import React from "react";
// import Navbar from "./components/Navbars/IndexNavbar";
// import Footer from "./components/Footers/Footer";
import LifeExpectancy from "./pages/LifeExpectancy";
import InfantMortalityTrend from "./pages/InfantMortalityTrend";
import HealthFacilityComposition from "./pages/HealthFacilityComposition";
import HealthCorrelation from "./pages/HealthCorrelation";
import MaternalMortalityChoropleth from "./pages/MaternalMortalityChoropleth";

export default function Dashboard() {
  return (
    <>
      {/* <Navbar /> */}

      <LifeExpectancy />
      <InfantMortalityTrend />
      <HealthFacilityComposition />
      <HealthCorrelation />
      <MaternalMortalityChoropleth />

      {/* <Footer /> */}
    </>
  );
}
