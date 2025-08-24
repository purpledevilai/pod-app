import { useTheme } from '@/src/providers/ThemeProvider';
import React from 'react';
import MarkdownDisplay, { MarkdownProps } from 'react-native-markdown-display';

// Children should be a single markdown string
type MDProps = Omit<MarkdownProps, 'children'> & { children: string };

export function Markdown({ children, ...rest }: MDProps) {
  const { colors, fonts } = useTheme();

  return (
    <MarkdownDisplay
      {...rest}
      style={{
        body: { color: colors.muted, fontFamily: fonts.regular, fontSize: 20, lineHeight: 28 },
        strong: { fontFamily: fonts.semibold },
        em: { fontStyle: 'italic' },
        paragraph: { marginTop: 18, marginBottom: 0 },
        // add link, list, heading styles if you want
      }}
    >
      {children}
    </MarkdownDisplay>
  );
}