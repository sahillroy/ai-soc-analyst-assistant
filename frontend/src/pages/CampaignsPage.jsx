import React from 'react';
import CampaignView from '../components/CampaignView';

export default function CampaignsPage({ alerts = [], setActivePage, setSelectedCampaign }) {
  return (
    <div className="flex flex-col">
      <CampaignView
        alerts={alerts}
        setActivePage={setActivePage}
        setSelectedCampaign={setSelectedCampaign}
      />
    </div>
  );
}
