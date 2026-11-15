import { useState, type ReactNode } from 'react';
import { View, Text, TextInput, StyleSheet, type TextInputProps } from 'react-native';
import { colors, fontFamily, fontSize, buttonRadius, sizes, spacing } from '@/theme';

type Props = {
  label: string;
  icon?: ReactNode;
  trailing?: ReactNode;
  error?: string;
} & TextInputProps;

export function Field({ label, icon, trailing, error, style, onFocus, onBlur, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View>
      <Text style={[styles.label, focused && styles.labelFocused]}>{label}</Text>
      <View style={[styles.row, focused && styles.rowFocused]}>
        {icon}
        <TextInput
          placeholderTextColor={colors.muted}
          style={[styles.input, style]}
          underlineColorAndroid="transparent"
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
        />
        {trailing}
      </View>
      {error !== undefined && error !== '' ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fontFamily.bold, fontSize: fontSize.xs, color: colors.ink, marginBottom: spacing.xs },
  labelFocused: { color: colors.blue },
  row: {
    height: sizes.inputHeight,
    borderRadius: buttonRadius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  rowFocused: { borderColor: colors.blue },
  input: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: colors.ink,
    padding: 0,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  error: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: colors.danger, marginTop: spacing.xs },
});
