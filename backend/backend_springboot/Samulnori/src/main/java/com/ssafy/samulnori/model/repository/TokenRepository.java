package com.ssafy.samulnori.model.repository;

import com.ssafy.samulnori.model.entity.TokenEntity;
import com.ssafy.samulnori.model.entity.UserEntity;
import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface TokenRepository extends JpaRepository<TokenEntity, Long> {
    Optional<TokenEntity> findByUser(UserEntity user);
    Optional<TokenEntity> findByRefreshToken(String refreshToken);

    @Modifying
    @Transactional
    @Query("DELETE FROM TokenEntity t WHERE t.user = :user")
    void deleteByUser(@Param("user") UserEntity user);
}