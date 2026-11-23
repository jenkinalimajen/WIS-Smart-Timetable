import React from 'react';
import { parseNoteMentionParts } from '../utils/timetable';

interface FormattedNoteTextProps {
  text: string;
  knownStaff?: string[];
  className?: string;
  boldMentionsOnly?: boolean;
}

/**
 * Renders note text where any '@' mention has the '@' removed
 * and the mentioned staff name automatically rendered in bold letters.
 */
export const FormattedNoteText: React.FC<FormattedNoteTextProps> = ({
  text,
  knownStaff = [],
  className = '',
}) => {
  if (!text) return null;
  const parts = parseNoteMentionParts(text, knownStaff);

  return (
    <span className={className}>
      {parts.map((p, idx) =>
        p.isMention ? (
          <strong
            key={idx}
            className="font-bold underline decoration-purple-400 decoration-1 text-purple-900 bg-purple-100/90 px-1 py-0.2 rounded"
          >
            {p.text}
          </strong>
        ) : (
          <span key={idx}>{p.text}</span>
        )
      )}
    </span>
  );
};
