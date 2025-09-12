package com.ssafy.samulnori.model.service;

import com.ssafy.samulnori.model.dto.VideoRequestDto;
import com.ssafy.samulnori.model.dto.VideoResponseDto;
import com.ssafy.samulnori.model.entity.UserEntity;
import com.ssafy.samulnori.model.entity.Video;
import com.ssafy.samulnori.model.repository.FollowRepository;
import com.ssafy.samulnori.model.repository.UserRepository;
import com.ssafy.samulnori.model.repository.VideoLikeRepository;
import com.ssafy.samulnori.model.repository.VideoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.nio.file.Files;
import java.time.Duration;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class VideoService {

    private final VideoRepository videoRepository;
    private final VideoLikeRepository videoLikeRepository;
    private final UserRepository userRepository;
    private final FollowRepository followRepository;
    private final S3Uploader s3Uploader;

    /**
     * 영상 등록 (한 번에 저장)
     * - S3 업로드로 URL 확보
     * - runtime이 비어있으면 서버에서 계산(ffprobe), 실패 시 0
     * - 모두 채워진 상태로 1회 save → NOT NULL 위반 방지
     */
    @Transactional
    public VideoResponseDto uploadVideo(VideoRequestDto requestDto) throws IOException {
        UserEntity user = userRepository.findById(requestDto.getUserId())
                .orElseThrow(() -> new IllegalArgumentException("유효하지 않은 사용자입니다."));

        // 필수 파일 검증 (컨트롤러에서도 1차 검증하지만 방어적으로 한 번 더)
        MultipartFile videoFile = requestDto.getVideoFile();
        if (videoFile == null || videoFile.isEmpty()) {
            throw new IllegalArgumentException("영상 파일은 필수입니다.");
        }

        // 1) S3 업로드
        String videoUrl = s3Uploader.uploadVideo(videoFile);

        String thumbnailUrl = null;
        MultipartFile thumbnailFile = requestDto.getThumbnailFile();
        if (thumbnailFile != null && !thumbnailFile.isEmpty()) {
            thumbnailUrl = s3Uploader.uploadThumbnail(thumbnailFile);
        }

        // 2) runtime 보정
        Integer runtime = requestDto.getRuntime();
        if (runtime == null) {
            runtime = computeRuntimeSeconds(videoFile); // 실패 시 0 리턴
        }

        // 3) DB 저장(값이 모두 채워진 상태)
        Video video = Video.builder()
                .user(user)
                .title(requestDto.getTitle())
                .description(requestDto.getDescription())
                .videoUrl(videoUrl)           // NOT NULL 충족
                .thumbnailUrl(thumbnailUrl)
                .runtime(runtime)             // NOT NULL 충족
                .build();

        Video saved = videoRepository.save(video);
        return VideoResponseDto.from(saved);
    }

    /**
     * 영상 수정
     * - 소유자 확인
     * - 새 파일 있으면 업로드 → URL 교체(새 UUID 키 → 브라우저 캐시 이슈 자연 해소)
     * - runtime은 새 영상이 올라왔는데 값이 없으면 다시 계산. 아니면 기존 유지
     */
    @Transactional
    public VideoResponseDto updateVideo(Long videoId, VideoRequestDto requestDto, Long userId) throws IOException {
        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 영상입니다."));

        if (!video.getUser().getId().equals(userId)) {
            throw new SecurityException("본인의 영상만 수정할 수 있습니다.");
        }

        String videoUrl = video.getVideoUrl();
        String thumbnailUrl = video.getThumbnailUrl();
        Integer runtime = video.getRuntime();

        MultipartFile videoFile = requestDto.getVideoFile();
        MultipartFile thumbnailFile = requestDto.getThumbnailFile();

        boolean videoReplaced = false;

        if (videoFile != null && !videoFile.isEmpty()) {
            videoUrl = s3Uploader.uploadVideo(videoFile);
            videoReplaced = true;
        }
        if (thumbnailFile != null && !thumbnailFile.isEmpty()) {
            thumbnailUrl = s3Uploader.uploadThumbnail(thumbnailFile);
        }

        // 새 영상이 업로드되었고, runtime이 안 왔으면 서버에서 계산
        if (videoReplaced) {
            if (requestDto.getRuntime() != null) {
                runtime = requestDto.getRuntime();
            } else {
                runtime = computeRuntimeSeconds(videoFile);
            }
        } else {
            // 영상 파일은 그대로인데 runtime만 들어왔다면 업데이트
            if (requestDto.getRuntime() != null) {
                runtime = requestDto.getRuntime();
            }
        }

        video.update(
                requestDto.getTitle(),
                requestDto.getDescription(),
                videoUrl,
                thumbnailUrl,
                runtime
        );

        Video updated = videoRepository.save(video);
        return VideoResponseDto.from(updated);
    }

    @Transactional
    public void deleteVideo(Long videoId, Long userId) {
        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 영상입니다."));

        if (!video.getUser().getId().equals(userId)) {
            throw new SecurityException("본인의 영상만 삭제할 수 있습니다.");
        }

        videoRepository.delete(video);
        // (선택) S3 객체 삭제는 정책에 따라 구현
    }

    // 단일 영상 상세 조회
    @Transactional
    public VideoResponseDto getVideo(Long videoId, Long userId) {
        // 1. 조회수 증가
        videoRepository.incrementViewCnt(videoId);

        // 2. 영상 다시 조회
        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 영상입니다."));

        // 3. 좋아요 여부 확인 (비로그인 사용자는 false)
        boolean likedByCurrentUser = false;
        if (userId != null) {
            likedByCurrentUser = videoLikeRepository.existsByUserIdAndVideoIdAndIsLikedTrue(userId, videoId);
        }

        return VideoResponseDto.from(video, likedByCurrentUser);
    }

    // 최신순 영상 리스트 (updatedAt 기준 권장)
    public List<VideoResponseDto> getLatestVideos() {
        return videoRepository.findAllByOrderByUpdatedAtDesc()
                .stream()
                .map(VideoResponseDto::from)
                .collect(Collectors.toList());
    }

    // 인기순 영상 리스트
    public List<VideoResponseDto> getPopularVideos() {
        return videoRepository.findAllByOrderByLikeCntDesc()
                .stream()
                .map(VideoResponseDto::from)
                .collect(Collectors.toList());
    }

    // 팔로우한 사람들 영상 리스트
    public List<VideoResponseDto> getFollowingVideos(Long userId) {
        List<Long> followeeIds = followRepository.findFolloweesByFollowerId(userId)
                .stream()
                .map(UserEntity::getId)
                .toList();

        List<Video> videos = videoRepository.findByUserIdIn(followeeIds);

        return videos.stream()
                .map(VideoResponseDto::from)
                .collect(Collectors.toList());
    }

    // 특정 사용자의 영상 목록
    public List<VideoResponseDto> getVideosByUser(Long userId) {
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
        return videoRepository.findByUser(user)
                .stream()
                .map(VideoResponseDto::from)
                .collect(Collectors.toList());
    }

    // 키워드 검색
    public List<VideoResponseDto> searchVideos(String keyword) {
        return videoRepository
                .findByTitleContainingIgnoreCaseOrDescriptionContainingIgnoreCase(keyword, keyword)
                .stream()
                .map(VideoResponseDto::from)
                .collect(Collectors.toList());
    }

    // ================== runtime 계산 (ffprobe) ==================
    /**
     * ffprobe로 동영상 길이(초)를 구함. 실패하면 0 반환.
     * EC2에 ffprobe가 설치되어 있어야 함: `sudo apt-get install -y ffmpeg`
     */
    private Integer computeRuntimeSeconds(MultipartFile videoFile) {
        File temp = null;
        try {
            temp = Files.createTempFile("upload_", "_" + videoFile.getOriginalFilename()).toFile();
            videoFile.transferTo(temp);

            // ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 <file>
            ProcessBuilder pb = new ProcessBuilder(
                    "ffprobe", "-v", "error",
                    "-show_entries", "format=duration",
                    "-of", "default=noprint_wrappers=1:nokey=1",
                    temp.getAbsolutePath()
            );
            pb.redirectErrorStream(true);
            Process p = pb.start();

            try (BufferedReader br = new BufferedReader(new InputStreamReader(p.getInputStream()))) {
                String line = br.readLine();
                p.waitFor();

                if (line != null) {
                    double seconds = Double.parseDouble(line.trim());
                    // 반올림하여 초 단위 int 반환
                    return (int) Math.round(seconds);
                }
            }
        } catch (Exception e) {
            // 계산 실패 → 0으로 폴백
            return 0;
        } finally {
            if (temp != null && temp.exists()) {
                temp.delete();
            }
        }
        return 0;
    }
}
