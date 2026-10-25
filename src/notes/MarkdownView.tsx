import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextStyle } from 'react-native';
import { INK, YELLOW, WHITE, MUTED, LINE } from '../theme';
import { parseInline, parseLine, Span } from './markdown';

function spanStyle(s: Span): TextStyle {
  const deco = [s.underline && 'underline', s.strike && 'line-through'].filter(Boolean).join(' ');
  return {
    fontWeight: s.bold ? '900' : undefined,
    fontStyle: s.italic ? 'italic' : undefined,
    textDecorationLine: (deco || undefined) as TextStyle['textDecorationLine'],
  };
}

function Inline({ text, style }: { text: string; style?: TextStyle | TextStyle[] }) {
  const spans = parseInline(text);
  return (
    <Text style={style}>
      {spans.length === 0 ? ' ' : spans.map((s, i) => <Text key={i} style={spanStyle(s)}>{s.text}</Text>)}
    </Text>
  );
}

interface Props {
  text: string;
  onToggleCheck?: (lineIndex: number) => void;
}

export default function MarkdownView({ text, onToggleCheck }: Props) {
  const lines = text.split('\n');
  return (
    <View>
      {lines.map((line, i) => {
        const info = parseLine(line);
        const indent = { marginLeft: Math.min(info.indent.length, 8) * 8 };
        switch (info.kind) {
          case 'h1':
            return <Inline key={i} text={info.content} style={[s.h1, indent]} />;
          case 'h2':
            return <Inline key={i} text={info.content} style={[s.h2, indent]} />;
          case 'quote':
            return (
              <View key={i} style={[s.quote, indent]}>
                <Inline text={info.content} style={s.quoteText} />
              </View>
            );
          case 'bullet':
            return (
              <View key={i} style={[s.item, indent]}>
                <View style={s.bullet} />
                <Inline text={info.content} style={s.itemText} />
              </View>
            );
          case 'number':
            return (
              <View key={i} style={[s.item, indent]}>
                <Text style={s.number}>{info.number}.</Text>
                <Inline text={info.content} style={s.itemText} />
              </View>
            );
          case 'check':
            return (
              <TouchableOpacity
                key={i}
                style={[s.item, indent]}
                activeOpacity={0.6}
                disabled={!onToggleCheck}
                onPress={() => onToggleCheck?.(i)}
              >
                <View style={[s.box, info.checked && s.boxOn]}>
                  {info.checked && <Text style={s.boxMark}>✓</Text>}
                </View>
                <Inline text={info.content} style={[s.itemText, info.checked ? s.done : {}]} />
              </TouchableOpacity>
            );
          default:
            return line.trim() === '' ? (
              <View key={i} style={s.blank} />
            ) : (
              <Inline key={i} text={line} style={s.p} />
            );
        }
      })}
    </View>
  );
}

const s = StyleSheet.create({
  h1: { fontSize: 28, fontWeight: '900', color: INK, letterSpacing: -0.5, marginTop: 6, marginBottom: 4 },
  h2: { fontSize: 21, fontWeight: '900', color: INK, marginTop: 6, marginBottom: 2 },
  p: { fontSize: 17, lineHeight: 25, color: INK },
  blank: { height: 12 },
  quote: { borderLeftWidth: 4, borderLeftColor: YELLOW, backgroundColor: WHITE, paddingLeft: 12, paddingVertical: 6, marginVertical: 2 },
  quoteText: { fontSize: 17, lineHeight: 25, color: INK, fontStyle: 'italic' },
  item: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 3 },
  itemText: { flex: 1, fontSize: 17, lineHeight: 25, color: INK },
  bullet: { width: 8, height: 8, backgroundColor: INK, marginTop: 9, marginLeft: 4, marginRight: 12 },
  number: { minWidth: 24, fontSize: 17, lineHeight: 25, fontWeight: '900', color: INK, marginRight: 4 },
  box: {
    width: 22,
    height: 22,
    borderWidth: LINE,
    borderColor: INK,
    backgroundColor: WHITE,
    marginTop: 2,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  boxOn: { backgroundColor: INK },
  boxMark: { color: YELLOW, fontSize: 13, fontWeight: '900' },
  done: { color: MUTED, textDecorationLine: 'line-through' },
});
