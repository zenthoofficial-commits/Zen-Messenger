
import React from 'react';

interface SegmentedControlProps {
  name: string;
  options: string[];
  selectedValue: string;
  onChange: (value: string) => void;
}

const SegmentedControl: React.FC<SegmentedControlProps> = ({ name, options, selectedValue, onChange }) => {
  return (
    <div className="w-full bg-base-tan/50 p-1 rounded-xl flex justify-between items-center relative">
      {options.map((option) => (
        <React.Fragment key={option}>
          <input
            type="radio"
            id={`${name}-${option}`}
            name={name}
            value={option}
            checked={selectedValue === option}
            onChange={() => onChange(option)}
            className="sr-only"
          />
          <label
            htmlFor={`${name}-${option}`}
            className={`w-full text-center py-2 rounded-lg cursor-pointer transition-colors duration-300 text-sm font-medium z-10
            ${selectedValue === option ? 'text-accent-green' : 'text-text-primary/70'}`}
          >
            {option}
          </label>
        </React.Fragment>
      ))}
       <div
        className="absolute top-1 bottom-1 bg-secondary-cream rounded-lg shadow-sm transition-all duration-300 ease-in-out"
        style={{
          width: `calc(100% / ${options.length} - 4px)`,
          left: `calc(${(100 / options.length) * options.indexOf(selectedValue)}% + 2px)`,
        }}
      />
    </div>
  );
};

export default SegmentedControl;
