import React, { useState } from 'react';
import { View, Button, Image, Text, StyleSheet, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';

export default function App() {
  const [image, setImage] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const SERVER_URL = "http://172.30.1.50:8000/analyze-foot"; // 또는 ngrok 주소

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      alert('사진 접근 권한이 필요합니다.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const uploadImage = async () => {
    if (!image) return;
    setLoading(true);

    const uriParts = image.split('.');
    const fileType = uriParts[uriParts.length - 1];

    const formData = new FormData();
    formData.append('file', {
      uri: image,
      name: `foot.${fileType}`,
      type: `image/${fileType}`,
    });

    try {
      const res = await axios.post(SERVER_URL, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data);
    } catch (err) {
      console.error(err);
      alert("서버 응답 오류");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Button title="발 사진 선택" onPress={pickImage} />
      {image && <Image source={{ uri: image }} style={styles.image} />}
      {image && <Button title="서버로 전송" onPress={uploadImage} />}
      {loading && <ActivityIndicator size="large" />}
      {result && (
        <View style={styles.result}>
          <Text>발 길이: {result.foot_length_mm} mm</Text>
          <Text>발볼 너비: {result.foot_width_mm} mm</Text>
          <Text>스케일 (mm/pixel): {result.mm_per_pixel}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  image: { width: '100%', height: 500, marginVertical: 20 },
  result: { marginTop: 20 },
});
