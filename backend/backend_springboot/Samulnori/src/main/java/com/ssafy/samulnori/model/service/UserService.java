package com.ssafy.samulnori.model.service;

import com.ssafy.samulnori.model.dto.*;
import com.ssafy.samulnori.model.dto.auth.LoginRequest;
import com.ssafy.samulnori.model.dto.auth.SignupRequest;
import com.ssafy.samulnori.model.dto.user.MyInfoRequestDTO;
import com.ssafy.samulnori.model.dto.user.MyInfoResponseDTO;
import com.ssafy.samulnori.model.dto.user.PageDTO;
import com.ssafy.samulnori.model.dto.user.UserDTO;
import com.ssafy.samulnori.model.entity.*;
import com.ssafy.samulnori.model.repository.*;
import com.ssafy.samulnori.util.JwtUtil;
import lombok.RequiredArgsConstructor;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import jakarta.transaction.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserService {

    private final JwtUtil jwtUtil;
    private final TokenService tokenService;
    private final UserRepository userRepository;
    private final FollowRepository followRepository;
    private final PasswordEncoder passwordEncoder;
    private final SocialAccountRepository socialAccountRepository;
    private final VideoRepository videoRepository;
    private final S3Uploader s3Uploader;


    // 회원가입
    @Transactional
    public void signup(SignupRequest request) throws IOException {
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new IllegalArgumentException("이미 사용 중인 이메일입니다.");
        }
        if (userRepository.findByNickname(request.getNickname()).isPresent()) {
            throw new IllegalArgumentException("이미 사용 중인 닉네임입니다.");
        }

        String profileImgUrl = null;
        MultipartFile file = request.getProfileImg();
        if (file != null && !file.isEmpty()) {
            profileImgUrl = s3Uploader.uploadProfileImage(file);
        }

        UserEntity user = UserEntity.builder()
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .nickname(request.getNickname())
                .profileImg(profileImgUrl)
                .createdAt(LocalDateTime.now())
                .build();

        userRepository.save(user);
        user.setLoginName("normal_" + user.getId());
        userRepository.save(user);
    }

    // 회원탈퇴
    @Transactional
    public void deleteUser(Long userId) {
        // 1. 본인이 팔로우한 모든 유저 조회
        List<UserEntity> followees = followRepository.findFolloweesByFollowerId(userId);

        for (UserEntity follow : followees) {
            Long followeeId = follow.getId(); // 혹은 follow.getFolloweeId()

            // 2. 팔로워 수 1 감소
            followRepository.decrementFollowerCnt(followeeId); // 아래 커스텀 쿼리 참고
        }

        // 3. 소셜 계정 삭제 (있는 경우만)
        if (socialAccountRepository.findByUserId(userId).isPresent()) {
            socialAccountRepository.deleteById(userId); // deleteById
        }
        // 4. 사용자 삭제
        userRepository.deleteById(userId);
    }

    // 로그인
    public UserEntity login(LoginRequest request) {
        UserEntity user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 계정입니다."));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new IllegalArgumentException("비밀번호가 틀렸습니다.");
        }

        return user;
    }

    // 로그아웃
    @Transactional
    public void logout(String refreshToken) {
        if (jwtUtil.isExpired(refreshToken)) {
            throw new IllegalArgumentException("이미 만료된 토큰입니다.");
        }

        String loginName = jwtUtil.getLoginName(refreshToken);
        UserEntity user = userRepository.findByLoginName(loginName)
                .orElseThrow(() -> new IllegalArgumentException("유저 없음"));

        tokenService.deleteByUser(user);
    }

    // 내 정보 불러오기
    public MyInfoResponseDTO getMyInfo(Long id) {
        UserEntity user = userRepository.findById(id).orElseThrow();

        String provider = socialAccountRepository.findByUserId(id)
                .map(SocialAccount::getProvider)
                .orElse("local");

        return MyInfoResponseDTO.builder()
                .id(id)
                .email(user.getEmail())
                .nickname(user.getNickname())
                .provider(provider)
                .profileImg(user.getProfileImg())  // URL 반환
                .introduce(user.getIntroduce())
                .createdAt(user.getCreatedAt())
                .build();
    }

    // 내 정보 수정하기
    public void updateMyInfo(Long id, MyInfoRequestDTO request) throws IOException {
        UserEntity user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("유저 없음"));

        user.setEmail(request.getEmail());
        user.setNickname(request.getNickname());

        MultipartFile profileImgFile = request.getProfileImg();
        if (profileImgFile != null && !profileImgFile.isEmpty()) {
            String uploadedUrl = s3Uploader.uploadProfileImage(profileImgFile);
            user.setProfileImg(uploadedUrl);
        }

        user.setIntroduce(request.getIntroduce());

        String currentPwd = request.getCurrentPassword();
        String newPwd = request.getNewPassword();
        if (currentPwd != null && !currentPwd.trim().isEmpty()
                && newPwd != null && !newPwd.trim().isEmpty()) {

            if (user.getPassword() == null) {
                throw new IllegalStateException("소셜 로그인 계정은 비밀번호를 변경할 수 없습니다.");
            }

            if (!passwordEncoder.matches(currentPwd, user.getPassword())) {
                throw new IllegalArgumentException("현재 비밀번호가 일치하지 않습니다.");
            }

            user.setPassword(passwordEncoder.encode(newPwd));
        }

        userRepository.save(user);
    }

    // 유저 검색
    public List<UserDTO> searchUsers(String keyword) {

        List<UserEntity> users= userRepository.findByNicknameContaining(keyword);
        
        return users.stream()
            .map(user -> UserDTO.builder()
                .nickname(user.getNickname())
                .id(user.getId())
                .profileImg(user.getProfileImg())
                .followerCnt(user.getFollowerCnt())
                .build())
            .collect(Collectors.toList());
    }

    // 유저 개인 페이지 조회
    @Transactional
    public PageDTO getUserProfile(Long userId) {
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("유저 없음"));

        List<Video> videos = videoRepository.findByUserId(userId);
        List<VideoResponseDto> videoResponse = videos.stream()
                .map(VideoResponseDto::from)
                .collect(Collectors.toList());

        UserDTO userDTO = UserDTO.builder()
                .nickname(user.getNickname())
                .id(user.getId())
                .profileImg(user.getProfileImg())
                .followerCnt(user.getFollowerCnt())
                .build();

        String intro = user.getIntroduce();

        return PageDTO.builder().userDTO(userDTO).videos(videoResponse).introduce(intro).build();
    }
}

