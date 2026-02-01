import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
}

const MatrixButton: React.FC<ButtonProps> = ({ children, variant = 'primary', className = '', ...props }) => {
  const baseStyle = "px-4 py-2 font-mono text-sm border rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2";
  
  const variants = {
    primary: "bg-gray-800 text-white border-gray-700 hover:bg-gray-900 focus:ring-gray-600 focus:ring-offset-gray-100",
    secondary: "bg-white text-gray-800 border-gray-300 hover:bg-gray-50 focus:ring-gray-400 focus:ring-offset-white",
    danger: "bg-red-900 text-red-100 border-red-800 hover:bg-red-950 focus:ring-red-700 focus:ring-offset-red-50"
  };

  return (
    <button 
      className={`${baseStyle} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default MatrixButton;