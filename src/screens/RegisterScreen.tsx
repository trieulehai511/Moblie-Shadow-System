import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, ScrollView, TextInput, Alert, TouchableOpacity } from 'react-native';
import api from '../services/api';



function RegisterScreen({ navigation }: any) {

  const [userName, setUserName] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [fullName, setFullName] = React.useState('');
  const [age, setAge] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);


  const handleRegister = async () => {
    if (userName.trim() === '' || password.trim() === '' || confirmPassword.trim() === '' || fullName.trim() === '' || age.trim() === '') {
      Alert.alert('Notice', 'Please fill in all fields');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Notice', 'Passwords do not match');
      return;
    }

    if (isNaN(Number(age)) || Number(age) <= 0) {
      Alert.alert('Notice', 'Please enter a valid age');
      return;
    }
    if (Number(age) < 16) {
      Alert.alert('Notice', 'You must be at least 16 years old to register');
      return;
    }
    setLoading(true);
    try {
      const response = await api.post('/hunter', { userName, password, profile: { fullName, age: Number(age) } });
      if (response.data?.code == 200) {
        Alert.alert('Success', 'Registration successful! Please log in.');
        navigation.replace('Login');
      }

    } catch (error: any) {
      const msg = error.response?.data?.message || 'Registration failed!';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }

  }


  return (
    <KeyboardAvoidingView>
      <ScrollView>
        <View >
          {/* title */}
          <MaterialCommunityIcons
            name="boxing-glove"
            size={42}
            color="#ffffff"
          // style={styles.logoIcon}
          />
          <Text >
            REGISTER
          </Text>
        </View>
        {/* Form inputs */}
        <View>
          <View>
            <Text >Hunter Username</Text>
            <TextInput
              placeholder="Enter your Hunter Username"
              value={userName}
              onChangeText={setUserName}
            />
          </View>
          <View>
            <Text >Hunter Passcode</Text>
            <TextInput
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
          </View>
          <View>
            <Text >Confirm Passcode</Text>
            <TextInput
              placeholder="••••••••"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPassword}
            /></View>
          <View>
            <Text>Full Name</Text>
            <TextInput
              placeholder="Enter your full name"
              value={fullName}
              onChangeText={setFullName}
            />
          </View>
          <View>
            <Text>Age</Text>
            <TextInput
              keyboardType="number-pad"
              placeholder="Enter your age"
              maxLength={3}
              value={age}
              onChangeText={setAge}
            /> 
          </View>
          <TouchableOpacity onPress={handleRegister}>
            <Text>AWAKEN</Text>
          </TouchableOpacity>
          <View>
            <Text>Already have an account?</Text>
            <TouchableOpacity onPress={() => navigation.replace('Login')}>
              <Text>Sign in</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  text: {
    color: '#fff',
    fontSize: 20,
  },
});

export default RegisterScreen;