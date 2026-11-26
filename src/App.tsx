import React from 'react';
import { AppProvider, useNavigation } from './context/AppContext';
import { Layout } from './components/Layout';
import { DashboardView } from './components/DashboardView';
import { DetailingActivitiesView } from './components/DetailingActivitiesView';
import { SettingsView } from './components/SettingsView';
import { ProductsCatalogView } from './components/ProductsCatalogView';
import { IndicationsDirectoryView } from './components/IndicationsDirectoryView';
import { DoseCalculatorView } from './components/DoseCalculatorView';
import { KnowledgeHubView } from './components/KnowledgeHubView';
import { TeamWorkspaceView } from './components/TeamWorkspaceView';
import { SpecialistsView } from './components/SpecialistsView';

const ActiveScreen: React.FC = () => {
  const { activeTab } = useNavigation();

  switch (activeTab) {
    case 'products':
      return <ProductsCatalogView />;
    case 'detailing':
      return <DetailingActivitiesView />;
    case 'indications':
      return <IndicationsDirectoryView />;
    case 'specialists':
      return <SpecialistsView />;
    case 'dose-calculator':
      return <DoseCalculatorView />;
    case 'knowledge':
      return <KnowledgeHubView />;
    case 'team':
      return <TeamWorkspaceView />;
    case 'settings':
      return <SettingsView />;
    case 'dashboard':
    default:
      return <DashboardView />;
  }
};

export default function App() {
  return (
    <AppProvider>
      <Layout>
        <ActiveScreen />
      </Layout>
    </AppProvider>
  );
}
