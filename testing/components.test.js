import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { Badge } from '../src/components/common/Badge';
import { Button } from '../src/components/common/Button';
import { EmptyState } from '../src/components/common/EmptyState';
import { Input } from '../src/components/common/Input';

describe('common component behavior', () => {
  test('Button renders its title and invokes onPress', async () => {
    const onPress = jest.fn();
    const screen = await render(<Button title="Save" onPress={onPress} />);
    await fireEvent.press(screen.getByText('Save'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('disabled Button ignores presses', async () => {
    const onPress = jest.fn();
    const screen = await render(<Button title="Delete" variant="danger" disabled onPress={onPress} />);
    await fireEvent.press(screen.getByText('Delete'));
    expect(onPress).not.toHaveBeenCalled();
  });

  test('loading Button swaps title for an activity indicator and cannot be pressed', async () => {
    const onPress = jest.fn();
    const screen = await render(<Button title="Saving" loading onPress={onPress} />);
    expect(screen.queryByText('Saving')).toBeNull();
    expect(JSON.stringify(screen.toJSON())).toContain('ActivityIndicator');
  });

  test('Input forwards value changes and blur', async () => {
    const onChangeText = jest.fn();
    const onBlur = jest.fn();
    const screen = await render(
      <Input label="Email" value="" placeholder="name@example.com" onChangeText={onChangeText} onBlur={onBlur} />,
    );
    const input = screen.getByPlaceholderText('name@example.com');
    await fireEvent.changeText(input, 'teacher@example.com');
    await fireEvent(input, 'blur');
    expect(onChangeText).toHaveBeenCalledWith('teacher@example.com');
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  test('password Input starts secure and toggles visibility', async () => {
    const screen = await render(
      <Input value="secret" placeholder="Password" secureTextEntry onChangeText={() => {}} />,
    );
    expect(screen.getByPlaceholderText('Password').props.secureTextEntry).toBe(true);
    await fireEvent.press(screen.getByText('eye-off-outline'));
    expect(screen.getByPlaceholderText('Password').props.secureTextEntry).toBe(false);
  });

  test('Input renders validation errors and respects editability', async () => {
    const screen = await render(
      <Input value="bad" placeholder="Email" error="Invalid email" editable={false} onChangeText={() => {}} />,
    );
    expect(screen.getByText('Invalid email')).toBeTruthy();
    expect(screen.getByPlaceholderText('Email').props.editable).toBe(false);
  });

  test('Badge renders known and unknown variants without losing its label', async () => {
    expect((await render(<Badge label="Active" variant="success" />)).getByText('Active')).toBeTruthy();
    expect((await render(<Badge label="Custom" variant="not-defined" />)).getByText('Custom')).toBeTruthy();
  });

  test('EmptyState conditionally renders message and action content', async () => {
    const screen = await render(
      <EmptyState title="No students" message="Create the first student." action={<Text>Add student</Text>} />,
    );
    expect(screen.getByText('No students')).toBeTruthy();
    expect(screen.getByText('Create the first student.')).toBeTruthy();
    expect(screen.getByText('Add student')).toBeTruthy();

    const minimal = await render(<EmptyState title="Nothing here" />);
    expect(minimal.queryByText('Create the first student.')).toBeNull();
  });
});
