package com.ssafy.samulnori.model.repository;

import com.ssafy.samulnori.model.entity.UserEntity;
import com.ssafy.samulnori.model.entity.Video;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
public interface VideoRepository extends JpaRepository<Video, Long> {
    // 특정 사용자가 업로드한 영상 목록 조회 (UserEntity 기준)
    List<Video> findByUser(UserEntity user);

    // 사용자 ID 기반 영상 목록 조회
    List<Video> findByUserId(Long userId);

    // 제목 또는 설명에 키워드가 포함된 영상 검색 (대소문자 무시)
    List<Video> findByTitleContainingIgnoreCaseOrDescriptionContainingIgnoreCase(String titleKeyword, String descriptionKeyword);

    // 최신 업로드순 영상 목록 조회
    List<Video> findAllByOrderByUpdatedAtDesc();

    // 좋아요 수 기준 인기 영상 목록 조회
    List<Video> findAllByOrderByLikeCntDesc();

    // 여러 아이디로 영상 조회
    List<Video> findByUserIdIn(List<Long> userId);

    // 조회수 증가
    @Modifying
    @Transactional
    @Query("UPDATE Video v SET v.viewCnt = v.viewCnt + 1 WHERE v.id = :id")
    void incrementViewCnt(@Param("id") Long id);
}
