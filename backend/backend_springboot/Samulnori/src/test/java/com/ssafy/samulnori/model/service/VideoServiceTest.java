//package com.ssafy.samulnori.model.service;
//
//import com.ssafy.samulnori.model.dto.VideoRequestDto;
//import com.ssafy.samulnori.model.dto.VideoResponseDto;
//import com.ssafy.samulnori.model.entity.UserEntity;
//import com.ssafy.samulnori.model.entity.Video;
//import com.ssafy.samulnori.model.repository.UserRepository;
//import com.ssafy.samulnori.model.repository.VideoRepository;
//import org.junit.jupiter.api.BeforeEach;
//import org.junit.jupiter.api.Test;
//import org.junit.jupiter.api.extension.ExtendWith;
//import org.mockito.*;
//import org.mockito.junit.jupiter.MockitoExtension;
//
//import java.time.LocalDateTime;
//import java.util.*;
//
//import static org.assertj.core.api.Assertions.*;
//import static org.mockito.Mockito.*;
//
//@ExtendWith(MockitoExtension.class)
//public class VideoServiceTest {
//
//    @InjectMocks
//    private VideoService videoService;
//
//    @Mock
//    private VideoRepository videoRepository;
//
//    @Mock
//    private UserRepository userRepository;
//
//    private UserEntity mockUser;
//    private Video mockVideo;
//
//    @BeforeEach
//    void setUp() {
//        mockUser = UserEntity.builder()
//                .id(1L)
//                .loginName("tester")
//                .build();
//
//        mockVideo = Video.builder()
//                .id(10L)
//                .user(mockUser)
//                .title("Sample Title")
//                .description("Sample Description")
//                .videoUrl("http://video.url")
//                .thumbnailUrl("http://thumbnail.url")
//                .createdAt(LocalDateTime.now())
//                .build();
//    }
//
//    // 영상 등록
//    @Test
//    void uploadVideo_success() {
//        // given
//        VideoRequestDto dto = new VideoRequestDto();
//        dto.setTitle("New Title");
//        dto.setDescription("desc");
//        dto.setVideoUrl("videoUrl");
//        dto.setThumbnailUrl("thumbUrl");
//        when(userRepository.findById(1L)).thenReturn(Optional.of(mockUser));
//        when(videoRepository.save(any(Video.class))).thenAnswer(invocation -> {
//            Video saved = invocation.getArgument(0);
//            saved.setCreatedAt(LocalDateTime.now()); // createdAt 수동 세팅
//            return saved;
//        });
//
//        // when
//        VideoResponseDto response = videoService.uploadVideo(1L, dto);
//
//        // then
//        assertThat(response.getTitle()).isEqualTo("New Title");
//        verify(videoRepository).save(any(Video.class));
//    }
//
//    @Test
//    void uploadVideo_fail_userNotFound() {
//        // given
//        when(userRepository.findById(999L)).thenReturn(Optional.empty());
//
//        // then
//        assertThatThrownBy(() -> videoService.uploadVideo(999L, new VideoRequestDto()))
//                .isInstanceOf(IllegalArgumentException.class)
//                .hasMessage("유효하지 않은 사용자입니다.");
//    }
//
//    // 영상 조회
//    @Test
//    void getVideo_success() {
//        // given
//        when(videoRepository.findById(10L)).thenReturn(Optional.of(mockVideo));
//
//        // when
//        VideoResponseDto result = videoService.getVideo(10L);
//
//        // then
//        assertThat(result.getId()).isEqualTo(10L);
//        verify(videoRepository).incrementViewCnt(10L);
//    }
//
//    @Test
//    void getVideo_fail_notFound() {
//        when(videoRepository.findById(999L)).thenReturn(Optional.empty());
//        assertThatThrownBy(() -> videoService.getVideo(999L))
//                .isInstanceOf(IllegalArgumentException.class)
//                .hasMessage("존재하지 않는 영상입니다.");
//    }
//
//    // 영상 수정
//    @Test
//    void updateVideo_success() {
//        VideoRequestDto dto = new VideoRequestDto();
//        dto.setTitle("updated");
//        dto.setDescription("desc");
//        dto.setVideoUrl("url");
//        dto.setThumbnailUrl("thumb");
//        when(videoRepository.findById(10L)).thenReturn(Optional.of(mockVideo));
//
//        VideoResponseDto result = videoService.updateVideo(10L, dto, mockUser.getId());
//
//        assertThat(result.getTitle()).isEqualTo("updated");
//    }
//
//    @Test
//    void updateVideo_fail_unauthorized() {
//        when(videoRepository.findById(10L)).thenReturn(Optional.of(mockVideo));
//        Long otherUserId = 2L;
//
//        assertThatThrownBy(() -> videoService.updateVideo(10L, new VideoRequestDto(), otherUserId))
//                .isInstanceOf(SecurityException.class)
//                .hasMessage("본인의 영상만 수정할 수 있습니다.");
//    }
//
//    // 영상 삭제
//    @Test
//    void deleteVideo_success() {
//        when(videoRepository.findById(10L)).thenReturn(Optional.of(mockVideo));
//
//        videoService.deleteVideo(10L, mockUser.getId());
//
//        verify(videoRepository).delete(mockVideo);
//    }
//
//    @Test
//    void deleteVideo_fail_unauthorized() {
//        when(videoRepository.findById(10L)).thenReturn(Optional.of(mockVideo));
//
//        assertThatThrownBy(() -> videoService.deleteVideo(10L, 2L))
//                .isInstanceOf(SecurityException.class)
//                .hasMessage("본인의 영상만 삭제할 수 있습니다.");
//    }
//
//    // 사용자 영상 목록 조회
//    @Test
//    void getVideosByUser_success() {
//        when(userRepository.findById(1L)).thenReturn(Optional.of(mockUser));
//        when(videoRepository.findByUser(mockUser)).thenReturn(List.of(mockVideo));
//
//        List<VideoResponseDto> result = videoService.getVideosByUser(1L);
//
//        assertThat(result).hasSize(1);
//    }
//
//    @Test
//    void getVideosByUser_fail_userNotFound() {
//        when(userRepository.findById(2L)).thenReturn(Optional.empty());
//
//        assertThatThrownBy(() -> videoService.getVideosByUser(2L))
//                .isInstanceOf(IllegalArgumentException.class)
//                .hasMessage("사용자를 찾을 수 없습니다.");
//    }
//}
