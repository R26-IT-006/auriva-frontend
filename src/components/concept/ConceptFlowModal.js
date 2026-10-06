import { useMemo } from 'react';
import FlowOverviewModal from '../common/FlowOverviewModal';
import { buildConceptFlow } from '../../data/conceptFlow';
import { getOrderedCategories, categoryHasVideo } from '../../data/conceptData';

/**
 * ConceptFlowModal.js
 *
 * "How it works" pop-up for ConceptCategoriesScreen — the Concept module's
 * stages (data/conceptFlow.js) in the shared FlowOverviewModal stepper.
 */
export default function ConceptFlowModal({ visible, onClose, theme }) {
  const stages = useMemo(() => buildConceptFlow(getOrderedCategories(), categoryHasVideo), []);
  return (
    <FlowOverviewModal
      visible={visible}
      onClose={onClose}
      theme={theme}
      stages={stages}
      subtitle="What happens when a concept is selected"
    />
  );
}
