package com.ssafy.samulnori.model.repository;

import com.ssafy.samulnori.model.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<UserEntity, Long> {

    Optional<UserEntity> findById(Long id);
    Optional<UserEntity> findByEmail(String email);
    Optional<UserEntity> findByNickname(String nickname);
    Optional<UserEntity> findByLoginName(String loginname);
    List<UserEntity> findByNicknameContaining(String keyword);
    void deleteById(Long id);
}
