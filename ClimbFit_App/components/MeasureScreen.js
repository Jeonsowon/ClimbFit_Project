import React, { useRef, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Camera } from 'expo-camera';
import * as THREE from 'three';

export default function MeasureScreen() {
  const cameraRef = useRef(null);
  const [hasPermission, setHasPermission] = useState(null);
  const [points, setPoints] = useState([]);
  const [distance, setDistance] = useState(null);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const handleTouch = (event) => {
    const { locationX, locationY } = event.nativeEvent;
    const newPoint = new THREE.Vector2(locationX, locationY);
    const newPoints = [...points, newPoint];
    setPoints(newPoints);

    if (newPoints.length === 2) {
      const dist = newPoints[0].distanceTo(newPoints[1]);
      setDistance((dist / 3).toFixed(1)); // 보정계수
    }
  };

  if (hasPermission === null) {
    return <View><Text>권한 상태 확인 중...</Text></View>;
  }

  if (!hasPermission) {
    return <View><Text>카메라 권한이 거부되었습니다.</Text></View>;
  }

  return (
    <View style={{ flex: 1 }} onTouchEnd={handleTouch}>
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        type={Camera.Constants.Type.back}
        ratio="16:9"
      />
      <View style={styles.overlay}>
        <Text style={styles.text}>
          {distance ? `📏 추정 거리: ${distance} mm` : '화면 두 지점을 터치해주세요'}
        </Text>
        <TouchableOpacity style={styles.reset} onPress={() => {
          setPoints([]); setDistance(null);
        }}>
          <Text style={{ color: 'white' }}>초기화</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    bottom: 40,
    width: '100%',
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 10,
    borderRadius: 10,
  },
  reset: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#333',
    borderRadius: 8,
  },
});
