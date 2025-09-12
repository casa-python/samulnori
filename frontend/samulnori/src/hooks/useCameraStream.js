import { useRef, useCallback } from 'react';
import useCameraStore from '../stores/cameraStore';

/**
 * 카메라 스트림(이미지)만 처리하는 hook
 * 'frame' 타입 메시지에만 반응
 */
const useCameraStream = () => {
  const imageObjRef = useRef(new Image());
  const animationFrameRef = useRef(null);
  
  const {
    setStreamStatus,
    setStreamReady,
    setImageLoading,
    setImageError,
    setImageDimensions,
    setCanvasRenderInfo,
    streamReady
  } = useCameraStore();

  // Canvas에 이미지 그리기 함수
  const drawImageToCanvas = useCallback((imageData) => {
    const canvas = document.querySelector('.webcam-video');
    if (!canvas) {
      return;
    }
    
    const ctx = canvas.getContext('2d');
    const img = imageObjRef.current;
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    img.onload = () => {
      animationFrameRef.current = requestAnimationFrame(() => {
        const container = canvas.parentElement;
        if (!container) {
          return;
        }
        
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        
        const imgRatio = img.width / img.height;
        const containerRatio = containerWidth / containerHeight;
        let drawWidth, drawHeight, offsetX = 0, offsetY = 0;
        
        if (imgRatio > containerRatio) {
          drawHeight = containerHeight;
          drawWidth = containerHeight * imgRatio;
          offsetX = (containerWidth - drawWidth) / 2;
        } else {
          drawWidth = containerWidth;
          drawHeight = containerWidth / imgRatio;
          offsetY = (containerHeight - drawHeight) / 2;
        }
        
        if (canvas.width !== containerWidth || canvas.height !== containerHeight) {
          canvas.width = containerWidth;
          canvas.height = containerHeight;
        }
        
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
        
        const scaleX = drawWidth / img.naturalWidth;
        const scaleY = drawHeight / img.naturalHeight;
        setCanvasRenderInfo({
          scaleX,
          scaleY,
          offsetX,
          offsetY,
          containerWidth,
          containerHeight
        });
        
        setImageDimensions(prev => {
          if (prev.width !== img.naturalWidth || prev.height !== img.naturalHeight) {
            return {
              width: img.naturalWidth,
              height: img.naturalHeight
            };
          }
          return prev;
        });
        
        if (!streamReady) {
          setStreamReady(true);
        }
        
        setImageLoading(false);
        setImageError(false);
      });
    };
    
    img.onerror = () => {
      setImageLoading(false);
      setImageError(true);
    };
    
    img.src = imageData;
  }, [streamReady, setImageDimensions, setStreamReady, setImageLoading, setImageError, setCanvasRenderInfo]);

  // 'frame' 타입 메시지 처리 함수 (base64, dataUrl, Blob/ArrayBuffer 모두 지원)
  const handleFrameMessage = useCallback((data) => {
    setStreamStatus('streaming');
    setImageLoading(true);
    setImageError(false);
    
    if (data instanceof Blob) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          drawImageToCanvas(reader.result);
        } catch (error) {
          setImageError(true);
          setImageLoading(false);
        }
      };
      reader.onerror = () => {
        setImageError(true);
        setImageLoading(false);
      };
      reader.readAsDataURL(data);
      return;
    }
    if (data instanceof ArrayBuffer) {
      const blob = new Blob([data], { type: 'image/jpeg' });
      const reader = new FileReader();
      reader.onload = () => {
        try {
          drawImageToCanvas(reader.result);
        } catch (error) {
          setImageError(true);
          setImageLoading(false);
        }
      };
      reader.onerror = () => {
        setImageError(true);
        setImageLoading(false);
      };
      reader.readAsDataURL(blob);
      return;
    }
    if (typeof data === 'string' && !data.startsWith('data:image')) {
      try {
        drawImageToCanvas(`data:image/jpeg;base64,${data}`);
      } catch (error) {
        setImageError(true);
        setImageLoading(false);
      }
      return;
    }
    if (typeof data === 'string' && data.startsWith('data:image')) {
      try {
        drawImageToCanvas(data);
      } catch (error) {
        setImageError(true);
        setImageLoading(false);
      }
      return;
    }
    setImageError(true);
    setImageLoading(false);
  }, [drawImageToCanvas, setStreamStatus, setImageLoading, setImageError]);

  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, []);

  return {
    handleFrameMessage,
    cleanup
  };
};

export default useCameraStream;