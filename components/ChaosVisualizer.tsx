import React from 'react';
import { ChaosParams } from '../types';

interface Props {
  params: ChaosParams;
  isAnimating: boolean;
  className?: string;
}

const ChaosVisualizer: React.FC<Props> = ({ className = '' }) => {
  return <div className={`hidden ${className}`} />;
};

export default ChaosVisualizer;