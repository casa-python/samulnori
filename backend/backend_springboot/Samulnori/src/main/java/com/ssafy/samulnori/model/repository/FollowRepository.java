package com.ssafy.samulnori.model.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.ssafy.samulnori.model.entity.Follow;
import com.ssafy.samulnori.model.entity.UserEntity;

import java.util.List;

@Repository
public interface FollowRepository extends JpaRepository<Follow, Long> {

    boolean existsByFollowerIdAndFolloweeId(Long followerId, Long followeeId);

    void deleteByFollowerIdAndFolloweeId(Long followerId, Long followeeId);

    @Query("SELECT f.follower FROM Follow f WHERE f.followee.id = :userId")
    List<UserEntity> findFollowersByFolloweeId(@Param("userId") Long userId);

    @Query("SELECT f.followee FROM Follow f WHERE f.follower.id = :userId")
    List<UserEntity> findFolloweesByFollowerId(@Param("userId") Long userId);

    @Modifying
    @Query("UPDATE UserEntity u SET u.followerCnt = u.followerCnt + 1 WHERE u.id = :id")
    void incrementFollowerCnt(@Param("id") Long id);

    @Modifying
    @Query("UPDATE UserEntity u SET u.followerCnt = u.followerCnt - 1 WHERE u.id = :id AND u.followerCnt > 0")
    void decrementFollowerCnt(@Param("id") Long id);
}
