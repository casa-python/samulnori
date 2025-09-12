package com.ssafy.samulnori.model.repository;

import com.ssafy.samulnori.model.entity.SocialAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SocialAccountRepository extends JpaRepository<SocialAccount, Long> {

    Optional<SocialAccount> findByProviderAndProviderId(String provider, String providerId);

    Optional<SocialAccount> findByUserId(Long userId);

    void deleteById (Long userId);
}
