package com.ssafy.samulnori.model.service;

import org.springframework.stereotype.Service;

import com.ssafy.samulnori.model.repository.*;
import com.ssafy.samulnori.model.entity.*;
import com.ssafy.samulnori.model.dto.user.UserDTO;

import lombok.RequiredArgsConstructor;
import jakarta.transaction.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class FollowService {

    private final FollowRepository followRepository;
    private final UserRepository userRepository;

    @Transactional
    public void follow(Long followerId, Long followeeId) {

        if (followRepository.existsByFollowerIdAndFolloweeId(followerId, followeeId)) {
            throw new IllegalArgumentException("이미 팔로우한 사용자입니다.");
        }

        Follow follow = Follow.builder()
                .follower(userRepository.findById(followerId).orElseThrow())
                .followee(userRepository.findById(followeeId).orElseThrow())
                .build();

        followRepository.save(follow);

        followRepository.incrementFollowerCnt(followeeId);
    }

    @Transactional
    public void unfollow(Long followerId, Long followeeId) {
        followRepository.deleteByFollowerIdAndFolloweeId(followerId, followeeId);
        followRepository.decrementFollowerCnt(followeeId);
    }

    public List<UserDTO> getFollowers(Long userId) {
        List<UserEntity> followers = followRepository.findFollowersByFolloweeId(userId);
        return followers.stream()
            .map(this::convertToDTO)
            .collect(Collectors.toList());
    }

    public List<UserDTO> getFollowings(Long userId) {
        List<UserEntity> followings = followRepository.findFolloweesByFollowerId(userId);
        return followings.stream()
            .map(this::convertToDTO)
            .collect(Collectors.toList());
    }

    private UserDTO convertToDTO(UserEntity user) {
        return UserDTO.builder()
                .nickname(user.getNickname())
                .id(user.getId())
                .profileImg(user.getProfileImg())
                .followerCnt(user.getFollowerCnt())
                .build();
    }
}